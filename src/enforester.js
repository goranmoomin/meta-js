const AST = require("shift-ast/checked");

const {
    Term,
    TokenTerm,
    DelimiterTerm
} = require("./term.js");

class Enforester {
    constructor(terms) {
        this.terms = terms;
    }

    peek(n = 0) {
        return this.terms[n];
    }

    advance() {
        const term = this.terms[0];
        this.terms = this.terms.slice(1);
        return term;
    }

    enforest() {
        return this.enforestStatement();
    }

    enforestStatement() {
        const lookahead = this.peek();
        if(this.isBrace(lookahead)) {
            return this.enforestBlockStatement();
        }

        return new AST.EmptyStatement();
    }

    enforestBlockStatement() {
        return new AST.BlockStatement({
            block: this.enforestBlock()
        });
    }

    enforestBlock() {
        const terms = this.matchBraces();
        const innerEnforester = new Enforester(terms);
        const bodyTerms = [];
        while(innerEnforester.terms.length > 0) {
            bodyTerms.push(innerEnforester.enforestStatement());
        }

        return new AST.Block({
            statements: bodyTerms
        });
    }

    matchBraces() {
        const term = this.advance();
        if(this.isBrace(term)) {
            return term.inner;
        }

        // TODO: saner error handling
        throw new Error();
    }

    isParen(term) {
        return term && (term instanceof DelimiterTerm) && term.isParen();
    }

    isBrace(term) {
        return term && (term instanceof DelimiterTerm) && term.isBrace();
    }

    isBracket(term) {
        return term && (term instanceof DelimiterTerm) && term.isBracket();
    }

    isSyntax(term) {
        return term && (term instanceof DelimiterTerm) && term.isSyntax();
    }
}

module.exports = Enforester;
