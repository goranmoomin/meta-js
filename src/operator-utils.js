const {
    Term,
    TokenTerm,
    DelimiterTerm
} = require("./term.js");

const unaryOperators = [
    "+", "-", "!", "~",
    "++", "--", "typeof",
    "void", "delete",
];

const binaryOperatorPrecedence = {
    "*": 13,
    "/": 13,
    "%": 13,
    "+": 12,
    "-": 12,
    ">>": 11,
    "<<": 11,
    ">>>": 11,
    "<": 10,
    "<=": 10,
    ">": 10,
    ">=": 10,
    "in": 10,
    "instanceof": 10,
    "==": 9,
    "!=": 9,
    "===": 9,
    "!==": 9,
    "&": 8,
    "^": 7,
    "|": 6,
    "&&": 5,
    "||": 4,
};

const assignOperators = [
    "=", "|=", "^=", "&=",
    "<<=", ">>=", ">>>=",
    "+=", "-=", "*=", "/=", "%="
];

const getOperatorPrec = term => {
    if(!isOperator(term)) {
        // FIXME: saner error handling
        throw new Error();
    }
    return binaryOperatorPrecedence[term.token.value];
};

const isUnaryOperator = term => {
    if(!(term instanceof TokenTerm)) {
        return false;
    }

    return (term.isPunctuator() || term.isIdentifier() || term.isKeyword()) &&
        unaryOperators.includes(term.token.value);
};

const isBinaryOperator = term => {
    if(!(term instanceof TokenTerm)) {
        return false;
    }

    return (term.isPunctuator() || term.isIdentifier() || term.isKeyword()) &&
        binaryOperatorPrecedence.hasOwnProperty(term.token.value);
};

const isOperator = term => {
    return isUnaryOperator(term) || isBinaryOperator(term);
};

const isAssignOperator = term => {
    if(!(term instanceof TokenTerm)) {
        return false;
    }

    return (term.isPunctuator() || term.isIdentifier() || term.isKeyword()) &&
        assignOperators.includes(term.token.value);
};

module.exports = {
    getOperatorPrec,
    isUnaryOperator,
    isBinaryOperator,
    isOperator,
    isAssignOperator
};
