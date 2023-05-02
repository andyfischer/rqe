import { parseQuery } from "../parseQuery";
import { it, expect } from '../../test'

it("parses a single step query", () => {
    parseQuery("a b c");
});

it("parses a piped query", () => {
    parseQuery("a b=2 | join b c=1");
});

