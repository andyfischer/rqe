
async function delay(ms) {
        await new Promise(resolve => setTimeout(resolve, ms));
}

export function mountTables(setup) {
    setup
    .table({
        attrs: {
            test_one_per_second: {}
        }
    })
    .get(async p => {
        for (let i = 0; i < 5; i++) {
            p.put({ test_one_per_second: i });
            await delay(1000);
        }
    });

    setup
    .table({
        attrs: {
            test_additional_attrs: {},
            a: {},
            b: {},
        }
    })
    .get(async p => {
        p.put({ a: 1 });
        p.put({ a: 2 });
        p.put({ a: 3 });

        await delay(1000);

        p.put({ a: 4, b: 1 });
        p.put({ a: 5, b: 2 });
        p.put({ a: 6, b: 3 });
    });

    setup
    .table({
        attrs: {
            test_increasing_width: {},
        }
    })
    .get(async p => {
        for (let i = 0; i < 10; i++) {
            p.put({ test_increasing_width: 'xxx'.repeat(i) })
            await delay(500);
        }
    });

    setup
    .table({
        attrs: {
            test_delayed_batch: {}
        }
    })
    .get(async p => {
        await new Promise(resolve => setTimeout(resolve, 1000));

        for (let i = 0; i < 5; i++) {
            p.put({ test_delayed_batch: i });
        }
    });

    setup
    .table({
        attrs: {
            test_never_ending: {}
        }
    })
    .get(async p => {
        let i = 0;
        while (true) {
            p.put({ test_never_ending: i++ });
            await delay(1000);
        }
    });
}

