const {
    TokenClass,
    TokenType
} = require("shift-parser/dist/tokenizer");

class Term {}

class TokenTerm extends Term {
    constructor(token){
        super();
        this.token = token;
    }

    is(tokenGroup) {
        // tokenGroup is a TokenClass or TokenType
        return this.token.type.klass === tokenGroup || this.token.type === tokenGroup;
    }

    isIdentifier() {
        return this.is(TokenClass.Ident);
    }

    isAssign() {
        return this.is(TokenType.ASSIGN);
    }

    isBooleanLiteral() {
        return this.is(TokenType.TRUE) || this.is(TokenType.FALSE);
    }

    isKeyword() {
        return this.is(TokenClass.Keyword);
    }

    isNullLiteral() {
        return this.is(TokenType.NULL);
    }

    isNumericLiteral() {
        return this.is(TokenClass.NumericLiteral);
    }

    isPunctuator() {
        return this.is(TokenClass.Punctuator);
    }

    isStringLiteral() {
        return this.is(TokenClass.StringLiteral);
    }

    isRegularExpression() {
        return this.is(TokenClass.RegularExpression);
    }

    isTemplate() {
        return this.is(TokenType.TEMPLATE);
    }

    isEOS() {
        return this.is(TokenType.EOS);
    }
}
class DelimiterTerm extends Term {
    static types = {
        BRACK: "BRACK",
        BRACE: "BRACE",
        PAREN: "PAREN",
        SYNTAX: "SYNTAX"
    };

    constructor(type = DelimiterTerm.types.BRACE, inner = []) {
        super();
        if(!Object.values(DelimiterTerm.types).includes(type)) {
            // TODO: saner error handling
            throw new Error();
        }
        this.type = type;
        this.inner = inner;
    }

    static delimiterTypeFromToken(delimiterToken) {
        switch(delimiterToken.type) {
        case TokenType.LBRACK: return DelimiterTerm.types.BRACK;
        case TokenType.LBRACE: return DelimiterTerm.types.BRACE;
        case TokenType.LPAREN: return DelimiterTerm.types.PAREN;
        case TokenType.LSYNTAX: return DelimiterTerm.types.SYNTAX;
        default: throw new Error(); // TODO: saner error handling
        }
        // unreachable
    }

    is(delimiterType) {
        return this.type === delimiterType;
    }

    isParen() {
        return this.is(DelimiterTerm.types.PAREN);
    }

    isBrace() {
        return this.is(DelimiterTerm.types.BRACE);
    }

    isBracket() {
        return this.is(DelimiterTerm.types.BRACK);
    }

    isSyntax() {
        return this.is(DelimiterTerm.types.SYNTAX);
    }
}

module.exports = {
    Term,
    TokenTerm,
    DelimiterTerm
};
