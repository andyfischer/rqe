
import { Item } from '../Item'
import { MountPointSpec } from '../MountPoint'
import { parseQueryTupleWithErrorCheck, parseTableDecl } from '../parser'
import { Step } from '../Step'
import { attrsToItem } from '../Query'

interface Config {
    db: any
    tableName?: string
    attrs: string
    location: string
    funcs: string[]
    debugSql?: boolean
}

class SQLiteTableState {
    hasSetupSchema = false
}

async function maybeSetupSchema(config: Config, state: SQLiteTableState, schema: Item) {
    if (state.hasSetupSchema)
        return;

    return new Promise(resolve => {
        config.db.all(`SELECT name FROM sqlite_master WHERE name='${config.tableName}'`, (found) => {
            if (found && found.length !== 0) {
                resolve(null);
                return;
            }

            const lines = [];
            for (const attr of Object.keys(schema)) {
                lines.push(`${attr} TEXT`);
            }

            const cmd = `CREATE TABLE ${config.tableName}(` +
                lines.join(',\n ') +
             ');';

            if (config.debugSql)
                console.log('sql:', cmd);

            config.db.run(cmd, () => {
                state.hasSetupSchema = true;
                resolve(null);
            });
        });
    });
}

function quote(s: any) {
    s = s + '';
    s = s.replace(/'/g, `''`);
    return `'${s}'`;
}

async function handleGet(config: Config, step: Step) {
    step.streaming();

    const whereLines = [];

    for (const [attr, value] of Object.entries(step.queryToItem())) {
        if (value !== null) {
            whereLines.push(`${attr} = ${quote(value)}`);
        }
    }

    let cmd = `SELECT * from ${config.tableName}`;

    if (whereLines.length > 0) {
        cmd += ' WHERE ' + whereLines.join(' AND ');
    }
    
    cmd += ';';

    if (config.debugSql)
        console.log('sql:', cmd);

    config.db.each(cmd, ((err, row) => {
        if (err) {
            console.log({err});
            step.putError(err);
        } else {
            step.put(row);
        }
    }), () => {
        step.done();
    });
}

async function handlePut(config: Config, schema: Item, state: SQLiteTableState, step: Step) {
    await maybeSetupSchema(config, state, schema);

    const columns = [];
    const values = [];

    const item = step.queryToItem();

    for (const [attr, value] of Object.entries(item)) {
        if (attr === 'put!')
            continue;
        if (value === null)
            continue;
        columns.push(attr);
        values.push(`${quote(value)}`);
    }

    const cmd = `INSERT INTO ${config.tableName} (${ columns.join(',') }) `+
        `VALUES (${values.join(',')});`

    if (config.debugSql)
        console.log('sql:', cmd);
    config.db.run(cmd);
}

async function handleDelete(config: Config, schema: Item, state: SQLiteTableState, step: Step) {
    await maybeSetupSchema(config, state, schema);

    const columns = [];
    const values = [];

    const item = step.queryToItem();
    const whereLines = [];

    for (const [attr, value] of Object.entries(step.queryToItem())) {
        if (value !== null) {
            whereLines.push(`${attr} = ${quote(value)}`);
        }
    }

    let cmd = `DELETE FROM ${config.tableName}`

    if (whereLines.length > 0)
        cmd += ` WHERE ${whereLines}`;

    cmd += ';';

    if (config.debugSql)
        console.log('sql:', cmd);
    config.db.run(cmd);
}

export function getSqliteTableMount(config: Config): MountPointSpec[] {
    const points: MountPointSpec[] = [];

    const state = new SQLiteTableState();

    const tableAttrs = parseQueryTupleWithErrorCheck(config.attrs, { expectVerb: false }).attrs;
    const schema = attrsToItem(tableAttrs);
    if (!config.tableName)
        config.tableName = config.location.replace(' ', '_');

    const location = parseTableDecl(config.location);

    if (location.t === 'parseError')
        throw new Error("Error parsing location: " + location.message);

    const funcStrs = [
        '-> ' + config.attrs,
        ...config.funcs,
    ];

    for (const funcStr of funcStrs) {
        const func = parseTableDecl(funcStr);
        if (func.t === 'parseError')
            throw new Error("Error parsing func: " + func);

        let run = (step) => handleGet(config, step);

        for (const attr of Object.values(location.attrs))
            attr.requiresValue = false;

        const attrs = {
            ...location.attrs,
            ...func.attrs,
        };

        if (attrs['put!']) {
            run = (step) => handlePut(config, schema, state, step);
            attrs['put!'] = { required: true } // make sure it's not requiresValue=true
        }

        if (attrs['delete!']) {
            run = (step) => handleDelete(config, schema, state, step);
            attrs['delete!'] = { required: true } // make sure it's not requiresValue=true
        }

        const spec: MountPointSpec = {
            attrs,
            run,
        };

        points.push(spec);
        // console.log('adding func', { location, func });
    }

    return points;
}
