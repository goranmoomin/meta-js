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
    isOperator
} = require("./operator-utils.js");

const EXPR_LOOP_OPERATOR = "EXPR_LOOP_OPERATOR";
const EXPR_LOOP_NO_CHANGE = "EXPR_LOOP_NO_CHANGE";
const EXPR_LOOP_EXPANSION = "EXPR_LOOP_EXPANSION";

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

        if(this.isPunctuator(lookahead, ";")) {
            return new AST.EmptyStatement();
        }

        return this.enforestExpressionStatement();
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

        this.term = null;
        return left;
    }

    enforestExpressionLoop() {
        this.term = null; // TODO: Better naming
        this.opCtx = {
            prec: 0,
            combine: x => x,
            stack: []
        };

        do {
            const term = this.enforestAssignmentExpression();
            if(term === EXPR_LOOP_NO_CHANGE && this.opCtx.stack.length > 0) {
                this.term = this.opCtx.combine(this.term);
                const { prec, combine } = this.opCtx.stack.pop();
                this.opCtx.prec = prec;
                this.opCtx.combine = combine;
            } else if(term === EXPR_LOOP_NO_CHANGE) {
                break;
            } else if(term === EXPR_LOOP_OPERATOR ||
                      term === EXPR_LOOP_EXPANSION) {
                this.term = null;
            } else {
                this.term = term;
            }
        } while(true);

        return this.term;
    }

    enforestAssignmentExpression() {
        const lookahead = this.peek();

        // checking cases when this.term is nothing...

        // numeric literals
        if(this.term === null && this.isNumericLiteral(lookahead)) {
            const term = this.advance();
            if(term.token.value === Infinity) {
                return new AST.LiteralInfinityExpression();
            }

            return new AST.LiteralNumericExpression({
                value: term.token.value
            });
        }

        // prefix unary ops
        if(this.term === null && this.isOperator(lookahead)) {
            return this.enforestUnaryExpression();
        }

        // check cases when this.term is something...

        // binary ops
        if(this.term && this.isOperator(lookahead)) {
            return this.enforestBinaryExpression();
        }

        return EXPR_LOOP_NO_CHANGE;
    }

    enforestUnaryExpression() {
        const operator = this.matchUnaryOperator();
        this.opCtx.stack.push({
            prec: this.opCtx.prec,
            combine: this.opCtx.combine
        });

        // TODO: with custom operators, operators might be more than 14
        this.opCtx.prec = 14;
        this.opCtx.combine = operand => {
            return new AST.UnaryExpression({
                operand,
                operator: operator.token.value
            });
        };

        return EXPR_LOOP_OPERATOR;
    }

    enforestBinaryExpression() {
        const left = this.term;
        const operator = this.peek();
        const operatorPrec = getOperatorPrec(operator);
        // assuming that all operators are left-associated
        // TODO: handle right-associated operators
        if(this.opCtx.prec < operatorPrec) {
            this.opCtx.stack.push({
                prec: this.opCtx.prec,
                combine: this.opCtx.combine
            });
            this.opCtx.prec = operatorPrec;
            this.opCtx.combine = right => {
                return new AST.BinaryExpression({
                    left,
                    operator: operator.token.value,
                    right
                });
            };
            this.advance();
            return EXPR_LOOP_OPERATOR;
        } else {
            const term = this.opCtx.combine(left);
            const { prec, combine } = this.opCtx.stack.pop();
            this.opCtx.prec = prec;
            this.opCtx.combine = combine;
            return term;
        }
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
        let lookahead = this.peek();
        if(lookahead && this.isPunctuator(lookahead, ";")) {
            this.advance();
        }
    }

    consumeComma() {
        let lookahead = this.peek();
        if(lookahead && this.isPunctuator(lookahead, ",")) {
            this.advance();
        }
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

    matchParens() {
        const term = this.advance();
        if(this.isParen(term)) {
            return term.inner;
        }

        // TODO: saner error handling
        throw new Error();
    }

    matchUnaryOperator() {
        const term = this.advance();
        if(isUnaryOperator(term)) {
            return term;
        }

        // TODO: saner error handling
        throw new Error();
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

    isKeyword(term, value) {
        return term && (term instanceof TokenTerm) && term.isKeyword() &&
            (value ? term.token.value === value : true);
    }

    isPunctuator(term, value) {
        return term && (term instanceof TokenTerm) && term.isPunctuator() &&
            (value ? term.token.value === value : true);
    }

    isOperator(term) {
        return term && (term instanceof TokenTerm) && isOperator(term);
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
