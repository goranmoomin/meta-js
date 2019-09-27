const { TokenType } = require("shift-parser/dist/tokenizer");

class Term {}

class TokenTerm extends Term {
    constructor(token){
        super();
        this.token = token;
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
}

module.exports = {
    Term,
    TokenTerm,
    DelimiterTerm
};
