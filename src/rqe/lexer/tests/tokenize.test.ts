import { tokenizeString, LexedText, t_line_comment } from "..";
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

it("handles identifiers", () => {
  expect(consise(tokenizeString("hello-there"))).toEqual(
    [
      {
        "columnStart": 1,
        "endPos": 11,
        "leadingIndent": 0,
        "length": 11,
        "lineStart": 1,
        "matchName": "plain_value",
        "startPos": 0,
        "tokenIndex": 0,
      },
    ]
  );
  expect(consise(tokenizeString("hello there"))).toEqual(
    [
      {
        "columnStart": 1,
        "endPos": 5,
        "leadingIndent": 0,
        "length": 5,
        "lineStart": 1,
        "matchName": "plain_value",
        "startPos": 0,
        "tokenIndex": 0,
      },
      {
        "columnStart": 6,
        "endPos": 6,
        "leadingIndent": 0,
        "length": 1,
        "lineStart": 1,
        "matchName": "space",
        "startPos": 5,
        "tokenIndex": 1,
      },
      {
        "columnStart": 7,
        "endPos": 11,
        "leadingIndent": 0,
        "length": 5,
        "lineStart": 1,
        "matchName": "plain_value",
        "startPos": 6,
        "tokenIndex": 2,
      },
    ]
  );

  expect(consise(tokenizeString("_abc123"))).toEqual(
    [
      {
        "columnStart": 1,
        "endPos": 7,
        "leadingIndent": 0,
        "length": 7,
        "lineStart": 1,
        "matchName": "plain_value",
        "startPos": 0,
        "tokenIndex": 0,
      },
    ]
  );
});

it("handles spaces", () => {
  expect(consise(tokenizeString("  -    "))).toEqual(
    [
      {
        "columnStart": 1,
        "endPos": 2,
        "leadingIndent": 2,
        "length": 2,
        "lineStart": 1,
        "matchName": "space",
        "startPos": 0,
        "tokenIndex": 0,
      },
      {
        "columnStart": 3,
        "endPos": 3,
        "leadingIndent": 2,
        "length": 1,
        "lineStart": 1,
        "matchName": "plain_value",
        "startPos": 2,
        "tokenIndex": 1,
      },
      {
        "columnStart": 4,
        "endPos": 7,
        "leadingIndent": 2,
        "length": 4,
        "lineStart": 1,
        "matchName": "space",
        "startPos": 3,
        "tokenIndex": 2,
      },
    ]
  );
});

it("handles special characters", () => {
  expect(consise(tokenizeString("%$!/"))).toEqual(
        [
          {
            "columnStart": 1,
            "endPos": 1,
            "leadingIndent": 0,
            "length": 1,
            "lineStart": 1,
            "matchName": "percent",
            "startPos": 0,
            "tokenIndex": 0,
          },
          {
            "columnStart": 2,
            "endPos": 2,
            "leadingIndent": 0,
            "length": 1,
            "lineStart": 1,
            "matchName": "dollar",
            "startPos": 1,
            "tokenIndex": 1,
          },
          {
            "columnStart": 3,
            "endPos": 3,
            "leadingIndent": 0,
            "length": 1,
            "lineStart": 1,
            "matchName": "exclamation",
            "startPos": 2,
            "tokenIndex": 2,
          },
          {
            "columnStart": 4,
            "endPos": 4,
            "leadingIndent": 0,
            "length": 1,
            "lineStart": 1,
            "matchName": "slash",
            "startPos": 3,
            "tokenIndex": 3,
          },
        ]
    );
});

it("provides identifier text", () => {
  const result = tokenizeString("apple banana-cherry");
  expect(result.tokens.length).toEqual(3);
  expect(result.getTokenText(result.tokens[0])).toEqual("apple");
  expect(result.getTokenText(result.tokens[2])).toEqual("banana-cherry");
});

it("handles line comments", () => {
  const result = tokenizeString("apple # banana", { bashStyleLineComments: true });
  expect(result.tokens.length).toEqual(3);
  expect(result.getTokenText(result.tokens[0])).toEqual("apple");
  expect(result.tokens[2].match).toEqual(t_line_comment);
  expect(result.getTokenText(result.tokens[2])).toEqual("# banana");
});

it("handles line comments 2", () => {
  const result = tokenizeString("apple # banana\nsecond line", { bashStyleLineComments: true });
  expect(result.tokens).toEqual(
    [
      {
        "columnStart": 1,
        "endPos": 5,
        "leadingIndent": 0,
        "length": 5,
        "lineStart": 1,
        "match": {
          "name": "plain_value",
        },
        "startPos": 0,
        "tokenIndex": 0,
      },
      {
        "columnStart": 6,
        "endPos": 6,
        "leadingIndent": 0,
        "length": 1,
        "lineStart": 1,
        "match": {
          "name": "space",
        },
        "startPos": 5,
        "tokenIndex": 1,
      },
      {
        "columnStart": 7,
        "endPos": 14,
        "leadingIndent": 0,
        "length": 8,
        "lineStart": 1,
        "match": {
          "name": "line_comment",
        },
        "startPos": 6,
        "tokenIndex": 2,
      },
      {
        "columnStart": 15,
        "endPos": 15,
        "leadingIndent": 0,
        "length": 1,
        "lineStart": 1,
        "match": {
          "name": "newline",
          "str": "\n",
        },
        "startPos": 14,
        "tokenIndex": 3,
      },
      {
        "columnStart": 1,
        "endPos": 21,
        "leadingIndent": 0,
        "length": 6,
        "lineStart": 2,
        "match": {
          "name": "plain_value",
        },
        "startPos": 15,
        "tokenIndex": 4,
      },
      {
        "columnStart": 7,
        "endPos": 22,
        "leadingIndent": 0,
        "length": 1,
        "lineStart": 2,
        "match": {
          "name": "space",
        },
        "startPos": 21,
        "tokenIndex": 5,
      },
      {
        "columnStart": 8,
        "endPos": 26,
        "leadingIndent": 0,
        "length": 4,
        "lineStart": 2,
        "match": {
          "name": "plain_value",
        },
        "startPos": 22,
        "tokenIndex": 6,
      },
    ]
  );
});

it("finds matching brackets", () => {
  expect(consise(tokenizeString("{ 1 2 3 ( 5 ) [ 6 7 ] }")))
    .toEqual(
            [
              {
                "columnStart": 1,
                "endPos": 1,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "matchName": "lbrace",
                "pairsWithIndex": 22,
                "startPos": 0,
                "tokenIndex": 0,
              },
              {
                "columnStart": 2,
                "endPos": 2,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "matchName": "space",
                "startPos": 1,
                "tokenIndex": 1,
              },
              {
                "columnStart": 3,
                "endPos": 3,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "matchName": "integer",
                "startPos": 2,
                "tokenIndex": 2,
              },
              {
                "columnStart": 4,
                "endPos": 4,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "matchName": "space",
                "startPos": 3,
                "tokenIndex": 3,
              },
              {
                "columnStart": 5,
                "endPos": 5,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "matchName": "integer",
                "startPos": 4,
                "tokenIndex": 4,
              },
              {
                "columnStart": 6,
                "endPos": 6,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "matchName": "space",
                "startPos": 5,
                "tokenIndex": 5,
              },
              {
                "columnStart": 7,
                "endPos": 7,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "matchName": "integer",
                "startPos": 6,
                "tokenIndex": 6,
              },
              {
                "columnStart": 8,
                "endPos": 8,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "matchName": "space",
                "startPos": 7,
                "tokenIndex": 7,
              },
              {
                "columnStart": 9,
                "endPos": 9,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "matchName": "lparen",
                "pairsWithIndex": 12,
                "startPos": 8,
                "tokenIndex": 8,
              },
              {
                "columnStart": 10,
                "endPos": 10,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "matchName": "space",
                "startPos": 9,
                "tokenIndex": 9,
              },
              {
                "columnStart": 11,
                "endPos": 11,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "matchName": "integer",
                "startPos": 10,
                "tokenIndex": 10,
              },
              {
                "columnStart": 12,
                "endPos": 12,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "matchName": "space",
                "startPos": 11,
                "tokenIndex": 11,
              },
              {
                "columnStart": 13,
                "endPos": 13,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "matchName": "rparen",
                "pairsWithIndex": 8,
                "startPos": 12,
                "tokenIndex": 12,
              },
              {
                "columnStart": 14,
                "endPos": 14,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "matchName": "space",
                "startPos": 13,
                "tokenIndex": 13,
              },
              {
                "columnStart": 15,
                "endPos": 15,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "matchName": "lbracket",
                "pairsWithIndex": 20,
                "startPos": 14,
                "tokenIndex": 14,
              },
              {
                "columnStart": 16,
                "endPos": 16,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "matchName": "space",
                "startPos": 15,
                "tokenIndex": 15,
              },
              {
                "columnStart": 17,
                "endPos": 17,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "matchName": "integer",
                "startPos": 16,
                "tokenIndex": 16,
              },
              {
                "columnStart": 18,
                "endPos": 18,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "matchName": "space",
                "startPos": 17,
                "tokenIndex": 17,
              },
              {
                "columnStart": 19,
                "endPos": 19,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "matchName": "integer",
                "startPos": 18,
                "tokenIndex": 18,
              },
              {
                "columnStart": 20,
                "endPos": 20,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "matchName": "space",
                "startPos": 19,
                "tokenIndex": 19,
              },
              {
                "columnStart": 21,
                "endPos": 21,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "matchName": "rbracket",
                "pairsWithIndex": 14,
                "startPos": 20,
                "tokenIndex": 20,
              },
              {
                "columnStart": 22,
                "endPos": 22,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "matchName": "space",
                "startPos": 21,
                "tokenIndex": 21,
              },
              {
                "columnStart": 23,
                "endPos": 23,
                "leadingIndent": 0,
                "length": 1,
                "lineStart": 1,
                "matchName": "rbrace",
                "pairsWithIndex": 0,
                "startPos": 22,
                "tokenIndex": 22,
              },
            ]
      );
});
