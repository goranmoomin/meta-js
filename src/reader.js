const {
    default: Tokenizer,
    TokenType,
    TokenClass
} = require("shift-parser/dist/tokenizer");
const R = require("ramda");

const {
    TokenTerm,
    DelimiterTerm
} = require("./term.js");

TokenType.LSYNTAX = { klass: TokenClass.Punctuator, name: "#`" };
TokenType.RSYNTAX = { klass: TokenClass.Punctuator, name: "`" };

const isLeftBracket = R.whereEq({ type: TokenType.LBRACK });
const isLeftBrace = R.whereEq({ type: TokenType.LBRACE });
const isLeftParen = R.whereEq({ type: TokenType.LPAREN });
const isLeftSyntax = R.whereEq({ type: TokenType.LSYNTAX });
const isRightBracket = R.whereEq({ type: TokenType.RBRACK });
const isRightBrace = R.whereEq({ type: TokenType.RBRACE });
const isRightParen = R.whereEq({ type: TokenType.RPAREN });
const isRightSyntax = R.whereEq({ type: TokenType.RSYNTAX });

const isEOS = R.whereEq({ type: TokenType.EOS });

const isLeftDelimiter = R.anyPass([
    isLeftBracket,
    isLeftBrace,
    isLeftParen,
    isLeftSyntax
]);

const isRightDelimiter = R.anyPass([
    isRightBracket,
    isRightBrace,
    isRightParen,
    isRightSyntax
]);

const isMatchingDelimiterPair = R.cond([
    [isLeftBracket, (_, d) => isRightBracket(d)],
    [isLeftBrace, (_, d) => isRightBrace(d)],
    [isLeftParen, (_, d) => isRightParen(d)],
    [isLeftSyntax, (_, d) => isRightSyntax(d)],
    [R.T, R.F]
]);

class Reader extends Tokenizer {
    constructor(source) {
        super(source);
        this.delimiters = [];
    }

    read() {
        const terms = [];
        do {
            const token = this.advance(); // returns token
            if(isEOS(token)) {
                // no delimiter should be left this point
                // FIXME: saner error handling
                if(this.delimiters.length > 0) { throw new Error(); }
                break;
            }
            if(isLeftDelimiter(token)) {
                const inner = this.read(); // the return value of this.read doesn't contain the last right delimiter
                // right delimiter is already consumed
                const delimiterType = DelimiterTerm.delimiterTypeFromToken(token);
                terms.push(new DelimiterTerm(delimiterType, inner));
            } else if(isRightDelimiter(token)) {
                // last delimiter is not expected to be included
                break;
            } else {
                terms.push(new TokenTerm(token));
            }
        } while(true);
        return terms;
    }

    advance() {
        // monkey patching
        const savedState = this.saveLexerState();

        let startLocation = this.getLocation();

        this.lastIndex = this.index;
        this.lastLine = this.line;
        this.lastLineStart = this.lineStart;

        this.skipComment();

        this.startIndex = this.index;
        this.startLine = this.line;
        this.startLineStart = this.lineStart;

        if(this.lastIndex === 0) {
            this.lastIndex = this.index;
            this.lastLine = this.line;
            this.lastLineStart = this.lineStart;
        }

        if(this.index >= this.source.length) {
            return { type: TokenType.EOS, slice: this.getSlice(this.index, startLocation) };
        }

        let charCode = this.source.charCodeAt(this.index);

        if(charCode === 0x23) { // character #
            const startLocation = this.getLocation();
            const start = this.index;
            const slice = this.getSlice(start, startLocation);
            this.index++;
            if(this.source.charCodeAt(this.index) === 0x60) {
                this.index++;
                const token = {
                    type: TokenType.LSYNTAX,
                    value: "#`",
                    slice
                };
                this.delimiters.push(token); // push left syntax token
                return token;
            }
            return {
                type: TokenType.IDENTIFIER,
                value: "#",
                slice
            };
        } else if(charCode === 0x60 &&
                  this.delimiters.length > 0 &&
                  isLeftSyntax(R.last(this.delimiters))) { // character `
            const startLocation = this.getLocation();
            const start = this.index;
            const slice = this.getSlice(start, startLocation);
            this.index++;
            this.delimiters.pop(); // pop left syntax token
            return {
                type: TokenType.RSYNTAX,
                value: "`",
                slice: slice
            };
        }

        // original behavior
        this.restoreLexerState(savedState);
        const token = super.advance();

        // if lookahead is left delimiter, push to this.delimiters
        // token LSYNTAX & RSYNTAX is already handled
        if(isLeftDelimiter(token)) {
            this.delimiters.push(token);
        } else if(isRightDelimiter(token)) {
            // check if it matches the left delimiter
            if(!(this.delimiters.length > 0 &&
                 isMatchingDelimiterPair(R.last(this.delimiters), token))) {
                // FIXME: saner error handling
                throw new Error();
            }
            this.delimiters.pop();
        }

        // handling of template string tokens
        if(token.type === TokenType.TEMPLATE) {
            const elements = [];
            let element = null;
            do {
                element = this.scanTemplateElement();
                elements.push(new TokenTerm(element));
                if(element.interp) {
                    // consume left brace
                    // FIXME: saner error handling
                    if(!isLeftBrace(this.advance())) { throw new Error(); };
                    elements.push(new DelimiterTerm(DelimiterTerm.types.BRACE, this.read())); // read until right brace
                }
            } while(!element.tail);
            return {
                type: TokenType.TEMPLATE,
                elements
            };
        } else if(token.type === TokenType.DIV ||
                  token.type === TokenType.ASSIGN_DIV) {
            // TODO: handle regex tokens
            return token;
        }

        return token;
    }

    scanTemplateElement() {
        let startLocation = this.getLocation();
        let start = this.index;
        while(this.index < this.source.length) {
            let ch = this.source.charCodeAt(this.index);
            switch(ch) {
            case 0x60: { // `
                const slice = this.getSlice(start, startLocation);
                this.index++;
                return {
                    type: TokenType.TEMPLATE,
                    tail: true,
                    interp: false,
                    slice
                };
            }
            case 0x24: { // $
                if(this.source.charCodeAt(this.index + 1) === 0x7B) { // {
                    const slice = this.getSlice(start, startLocation);
                    this.index++;
                    return {
                        type: TokenType.TEMPLATE,
                        tail: false,
                        interp: true,
                        slice
                    };
                }
                this.index++;
                break;
            }
            case 0x5C: { // \\
                let octal = this.scanStringEscape('', null)[1];
                if(octal != null) {
                    throw this.createError(ErrorMessages.NO_OCTALS_IN_TEMPLATES);
                }
                break;
            }
            case 0x0D: { // \r
                this.line++;
                this.index++;
                if(this.index < this.source.length && this.source.charAt(this.index) === '\n') {
                    this.index++;
                }
                this.lineStart = this.index;
                break;
            }
            case 0x0A: // \r
            case 0x2028:
            case 0x2029: {
                this.line++;
                this.index++;
                this.lineStart = this.index;
                break;
            }
            default:
                this.index++;
            }
        }

        throw this.createILLEGAL();
    }
};

module.exports = Reader;
