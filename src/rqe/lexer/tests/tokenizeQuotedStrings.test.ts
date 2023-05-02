
import { tokenizeString, LexedText } from "..";
import { it, expect } from '../../test'

function consise(result: LexedText) {
  return result.tokens.map((token: any) => {
    token = {
      matchName: token.match && token.match.name,
      ...token
    };
    delete token.match;
    return token;
  });
}

it("handles single quote strings", () => {
  const tokens = consise(tokenizeString('"there"'));
  expect(tokens[0].matchName).toEqual("quoted_string");
  expect(tokens.length).toEqual(1);
});

it("handles double quote strings", () => {
  const tokens = consise(tokenizeString("'there'"));
  expect(tokens[0].matchName).toEqual("quoted_string");
  expect(tokens.length).toEqual(1);
});

it("handles quotes inside strings", () => {
  const result = tokenizeString(`"contains a 'quoted' section"`);
  const tokens = result.tokens;
  expect(tokens[0].match.name).toEqual("quoted_string");
  expect(result.getTokenText(result.tokens[0])).toEqual(`"contains a 'quoted' section"`);
  expect(tokens.length).toEqual(1);
});

it("handles escaped quotes inside strings", () => {
  const result = tokenizeString(`"the \\" character"`);
  const tokens = result.tokens;
  expect(tokens[0].match.name).toEqual("quoted_string");
  expect(result.getTokenText(result.tokens[0])).toEqual(`"the \\" character"`);
  expect(tokens.length).toEqual(1);
});

it("getUnquotedText gets the correct string", () => {
    const result = tokenizeString(`"the string"`);
    expect(result.getUnquotedText(result.tokens[0])).toEqual("the string");
});

it("getUnquotedText unescapes", () => {
    const result = tokenizeString(`"the \\" character"`);
    expect(result.getUnquotedText(result.tokens[0])).toEqual(`the " character`);
});

it("getUnquotedText unescapes multiple", () => {
    const result = tokenizeString(`"\\a \\b \\c \\d \\e"`);
    expect(result.getUnquotedText(result.tokens[0])).toEqual(`a b c d e`);
});
