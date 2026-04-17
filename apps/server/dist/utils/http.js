"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fail = exports.created = exports.ok = void 0;
const ok = (res, data, message) => {
    return res.status(200).json({ data, message });
};
exports.ok = ok;
const created = (res, data, message) => {
    return res.status(201).json({ data, message });
};
exports.created = created;
const fail = (res, status, message) => {
    return res.status(status).json({ error: message });
};
exports.fail = fail;
