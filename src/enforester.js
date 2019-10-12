const R = require("ramda");
const AST = require("shift-ast/checked");

const {
    Term,
    TokenTerm,
    DelimiterTerm
} = require("./term.js");

const {
    getOperatorPrec,
    isBinaryOperator,
    isUnaryOperator,
    isOperator,
    isAssignOperator
} = require("./operator-utils.js");

class Enforester {
    constructor(terms) {
        this.terms = terms;
        this.term = null; // term the enforester is working on
        this.operators = []; // the operator stack
        // this.operators should not be manipulated outside
        // of this.enforestExpressionLoop()
    }

    peek(n = 0) {
        return this.terms[n];
    }

    advance() {
        const term = this.terms[0];
        this.terms = this.terms.slice(1);
        return term;
    }

    get operator() {
        // TODO: saner error handling
        if(this.operators.length === 0) {
            throw new Error();
        }

        return R.last(this.operators);
    }

    enforest() {
        return this.enforestStatement();
    }

    enforestStatement() {
        const lookahead = this.peek();
        if(this.isBrace(lookahead)) {
            return this.enforestBlockStatement();
        }

        if(this.isKeyword(lookahead, "while")) {
            return this.enforestWhileStatement();
        }

        if(this.isPunctuator(lookahead, ";")) {
            return new AST.EmptyStatement();
        }

        return this.enforestExpressionStatement();
    }

    enforestWhileStatement() {
        this.matchKeyword("while");
        const condition = this.matchParens();
        const conditionEnforester = new Enforester(condition);
        const test = conditionEnforester.enforestExpression();
        // TODO: saner error handling
        if(!test) {
            throw new Error();
        }
        const body = this.enforestStatement();
        return new AST.WhileStatement({
            test,
            body
        });
    }

    enforestExpressionStatement() {
        const expression = this.enforestExpression();
        this.consumeSemicolon();
        return new AST.ExpressionStatement({
            expression
        });
    }

    enforestExpression() {
        let left = this.enforestExpressionLoop();

        while(this.isPunctuator(this.peek(), ",")) {
            const operator = this.advance();
            const right = this.enforestExpressionLoop();
            left = new AST.BinaryExpression({
                left,
                operator: operator.token.value,
                right
            });
        }

        return left;
    }

    enforestExpressionLoop() {
        // something is wrong if this.term isn't null
        // or if this.operators isn't empty
        // TODO: saner error handling
        if(this.term !== null || this.operators.length !== 0) {
            throw new Error();
        }

        // default operator
        this.operators.push({
            prec: 0,
            combine: x => x
        });

        while(this.operators.length > 0) {
            const lookahead = this.peek();

            // checking cases when this.term is nothing...
            // numeric literals
            if(this.term === null && this.isNumericLiteral(lookahead)) {
                this.term = this.enforestNumericLiteral();
                continue;
            }

            // string literals
            if(this.term === null && this.isStringLiteral(lookahead)) {
                this.term = this.enforestStringLiteral();
                continue;
            }

            // boolean literals
            if(this.term === null && this.isBooleanLiteral(lookahead)) {
                this.term = this.enforestBooleanLiteral();
                continue;
            }

            // null literals
            if(this.term === null && this.isNullLiteral(lookahead)) {
                this.term = this.enforestNullLiteral();
                continue;
            }

            // prefix unary ops
            if(this.term === null && this.isOperator(lookahead)) {
                // TODO: check if unary operator
                this.pushUnaryOperator();
                continue;
            }

            // check cases when this.term is something...
            // binary ops
            // only if following operator is higher than current
            // assuming that all operators are left-associated
            // TODO: handle right-associated operators
            if(this.term && this.isOperator(lookahead) &&
               this.operator.prec < getOperatorPrec(lookahead)) {
                // TODO: check if binary operator
                this.pushBinaryOperator();
                this.term = null;
                continue;
            }

            this.term = this.operator.combine(this.term);
            this.operators.pop();
        }

        const term = this.term;
        this.term = null;

        return term;
    }

    enforestNumericLiteral() {
        const term = this.advance();
        if(term.token.value === Infinity) {
            return new AST.LiteralInfinityExpression();
        }

        return new AST.LiteralNumericExpression({
            value: term.token.value
        });
    }

    enforestStringLiteral() {
        const term = this.advance();
        return new AST.LiteralStringExpression({
            value: term.token.str
        });
    }

    enforestBooleanLiteral() {
        const term = this.advance();
        return new AST.LiteralBooleanExpression({
            value: term.token.value === "true"
        });
    }

    enforestNullLiteral() {
        this.advance();
        return new AST.LiteralNullExpression();
    }

    pushUnaryOperator() {
        const operator = this.advance();
        this.operators.push({
            // TODO: custom unary operators might have different precedence
            prec: 14,
            combine: operand => new AST.UnaryExpression({
                operand,
                operator: operator.token.value
            })
        });
    }

    pushBinaryOperator() {
        const left = this.term;
        const operator = this.advance();
        // assuming that all operators are left-associated
        // TODO: handle right-associated operators
        this.operators.push({
            prec: getOperatorPrec(operator),
            combine: right => new AST.BinaryExpression({
                left,
                operator: operator.token.value,
                right
            })
        });
    }

    enforestBlockStatement() {
        return new AST.BlockStatement({
            block: this.enforestBlock()
        });
    }

    enforestBlock() {
        const blockTerms = this.matchBraces();
        const innerEnforester = new Enforester(blockTerms);
        const statements = [];
        while(innerEnforester.terms.length > 0) {
            statements.push(innerEnforester.enforestStatement());
        }

        return new AST.Block({ statements });
    }

    consumeSemicolon() {
        const lookahead = this.peek();
        if(lookahead && this.isPunctuator(lookahead, ";")) {
            this.advance();
        }
    }

    consumeComma() {
        const lookahead = this.peek();
        if(lookahead && this.isPunctuator(lookahead, ",")) {
            this.advance();
        }
    }

    matchIdentifier(value) {
        const lookahead = this.advance();
        if(this.isIdentifier(lookahead, value)) {
            return lookahead;
        }

        // TODO: saner error handling
        throw new Error();
    }

    matchLiteral() {
        const lookahead = this.advance();
        // TODO: handle regexes
        if(this.isNumericLiteral(lookahead) ||
           this.isStringLiteral(lookahead) ||
           this.isTemplate(lookahead) ||
           this.isBooleanLiteral(lookahead) ||
           this.isNullLiteral(lookahead)) {
            return lookahead;
        }

        // TODO: saner error handling
        throw new Error();
    }

    matchOperator(value) {
        const lookahead = this.advance();
        if(this.isOperator(lookahead, value)) {
            return lookahead;
        }

        // TODO: saner error handling
        throw new Error();
    }

    matchAssignOperator(value) {
        const lookahead = this.advance();
        if(this.isAssignOperator(lookahead, value)) {
            return lookahead;
        }

        // TODO: saner error handling
        throw new Error();
    }

    matchKeyword(value) {
        const lookahead = this.advance();
        if(this.isKeyword(lookahead, value)) {
            return lookahead;
        }

        // TODO: saner error handling
        throw new Error();
    }

    matchPunctuator(value) {
        const lookahead = this.advance();
        if(this.isPunctuator(lookahead, value)) {
            return lookahead;
        }

        // TODO: saner error handling
        throw new Error();
    }

    matchParens() {
        const term = this.advance();
        if(this.isParen(term)) {
            return term.inner;
        }

        // TODO: saner error handling
        throw new Error();
    }

    matchBrackets() {
        const term = this.advance();
        if(this.isBracket(term)) {
            return term.inner;
        }

        // TODO: saner error handling
        throw new Error();
    }

    matchBraces() {
        const term = this.advance();
        if(this.isBrace(term)) {
            return term.inner;
        }

        // TODO: saner error handling
        throw new Error();
    }

    matchSyntaxes() {
        const term = this.advance();
        if(this.isSyntax(term)) {
            return term.inner;
        }

        // TODO: saner error handling
        throw new Error();
    }

    isIdentifier(term, value) {
        return term && (term instanceof TokenTerm) && term.isIdentifier() &&
            (value ? term.token.value === value : true);
    }

    isNumericLiteral(term) {
        return term && (term instanceof TokenTerm) && term.isNumericLiteral();
    }

    isStringLiteral(term) {
        return term && (term instanceof TokenTerm) && term.isStringLiteral();
    }

    isTemplate(term) {
        return term && (term instanceof TokenTerm) && term.isTemplate();
    }

    isBooleanLiteral(term) {
        return term && (term instanceof TokenTerm) && term.isBooleanLiteral();
    }

    isNullLiteral(term) {
        return term && (term instanceof TokenTerm) && term.isNullLiteral();
    }

    isOperator(term, value) {
        return term && (term instanceof TokenTerm) && isOperator(term) &&
            (value ? term.token.value === value : true);
    }

    isAssignOperator(term) {
        return term && (term instanceof TokenTerm) && isAssignOperator(term) &&
            (value ? term.token.value === value : true);
    }

    isKeyword(term, value) {
        return term && (term instanceof TokenTerm) && term.isKeyword() &&
            (value ? term.token.value === value : true);
    }

    isPunctuator(term, value) {
        return term && (term instanceof TokenTerm) && term.isPunctuator() &&
            (value ? term.token.value === value : true);
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
