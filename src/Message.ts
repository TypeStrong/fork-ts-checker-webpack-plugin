import NormalizedMessage = require('./NormalizedMessage');

export default interface Message {
    diagnostics: NormalizedMessage[];
    lints: NormalizedMessage[];
}
