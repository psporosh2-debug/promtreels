var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
import http from 'node:http';
import { URL } from 'node:url';
var port = Number(process.env.PORT || 8787);
function json(res, status, body) { res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(body)); }
function body(req) {
    return __awaiter(this, void 0, void 0, function () { var s, c, e_1_1; var _a, req_1, req_1_1; var _b, e_1, _c, _d; return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                s = '';
                _e.label = 1;
            case 1:
                _e.trys.push([1, 6, 7, 12]);
                _a = true, req_1 = __asyncValues(req);
                _e.label = 2;
            case 2: return [4 /*yield*/, req_1.next()];
            case 3:
                if (!(req_1_1 = _e.sent(), _b = req_1_1.done, !_b)) return [3 /*break*/, 5];
                _d = req_1_1.value;
                _a = false;
                c = _d;
                s += c;
                _e.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_1_1 = _e.sent();
                e_1 = { error: e_1_1 };
                return [3 /*break*/, 12];
            case 7:
                _e.trys.push([7, , 10, 11]);
                if (!(!_a && !_b && (_c = req_1.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _c.call(req_1)];
            case 8:
                _e.sent();
                _e.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_1) throw e_1.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12: return [2 /*return*/, s ? JSON.parse(s) : {}];
        }
    }); });
}
var server = http.createServer(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var u, b, actions, instruction, r, d, text, data, b, prompt_1, r, d, text, data, b, headers, r, _a, _b, e_2;
    var _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    return __generator(this, function (_q) {
        switch (_q.label) {
            case 0:
                _q.trys.push([0, 13, , 14]);
                u = new URL(req.url || '/', "http://".concat(req.headers.host));
                if (req.method === 'OPTIONS') {
                    res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST,OPTIONS', 'access-control-allow-headers': 'content-type' });
                    return [2 /*return*/, res.end()];
                }
                if (!(u.pathname === '/api/ai/prompt-lab' && req.method === 'POST')) return [3 /*break*/, 4];
                return [4 /*yield*/, body(req)];
            case 1:
                b = _q.sent();
                if (!process.env.GEMINI_API_KEY)
                    return [2 /*return*/, json(res, 503, { success: false, message: 'GEMINI_API_KEY is not configured on the server.' })];
                actions = { generate: 'Generate a structured reusable image/video prompt from the user brief.', enhance: 'Enhance the prompt for composition, subject, lighting, camera, environment, motion and style.', fix: 'Diagnose ambiguity, contradictions, missing information and provide an improved prompt.', translate: 'Translate the prompt while preserving model parameters and technical tokens.', variation: 'Generate exactly five materially different prompt variations.', analyze: 'Analyze prompt quality, structure, missing information, style, lighting, camera and composition.', image_to_video: 'Convert the visual prompt into a video prompt with motion, camera movement and temporal consistency.', video_to_image: 'Convert the video prompt into a still-image prompt while preserving subject, environment and style.' };
                instruction = "You are PromptReels AI Prompt Lab. Task: ".concat(actions[b.action] || actions.analyze, " Target language: ").concat(b.language || 'English', ". User input: ").concat(b.promptText || '', ". Extra: ").concat(b.extra || '', ". Return concise JSON. For variation return {variations:[5 strings],negativePrompt:string}. For analysis/fix return {issues:[{problem,why,fix}],improvedPrompt:string,summary:string}. For enhance/generate/conversion return {generatedPrompt:string,negativePrompt:string,style:string,aspectRatio:string,model:string,tags:string[]}. For translate return {translatedPrompt:string}. Never claim to have generated media. Never execute commands or backend operations.");
                return [4 /*yield*/, fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=".concat(process.env.GEMINI_API_KEY), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: instruction }] }], generationConfig: { responseMimeType: 'application/json' } }) })];
            case 2:
                r = _q.sent();
                return [4 /*yield*/, r.json()];
            case 3:
                d = _q.sent();
                text = ((_g = (_f = (_e = (_d = (_c = d === null || d === void 0 ? void 0 : d.candidates) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.content) === null || _e === void 0 ? void 0 : _e.parts) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.text) || '{}';
                data = {};
                try {
                    data = JSON.parse(text);
                }
                catch (_r) {
                    data = { generatedPrompt: text };
                }
                return [2 /*return*/, json(res, r.ok ? 200 : 502, { success: r.ok, data: data, message: r.ok ? undefined : (_h = d === null || d === void 0 ? void 0 : d.error) === null || _h === void 0 ? void 0 : _h.message })];
            case 4:
                if (!(u.pathname === '/api/ai/reels-prompt-assistant' && req.method === 'POST')) return [3 /*break*/, 8];
                return [4 /*yield*/, body(req)];
            case 5:
                b = _q.sent();
                if (!process.env.GEMINI_API_KEY)
                    return [2 /*return*/, json(res, 503, { success: false, message: 'GEMINI_API_KEY is not configured on the server.' })];
                prompt_1 = "You are a safe prompt engineering assistant. Action: ".concat(b.action, ". Title: ").concat(b.title || '', ". Category: ").concat(b.category || '', ". Prompt: ").concat(b.promptText || '', ". Extra instructions: ").concat(b.extraInstructions || '', ". Return JSON with enhancedPrompt, translatedPrompt, tips, concepts when applicable.");
                return [4 /*yield*/, fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=".concat(process.env.GEMINI_API_KEY), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt_1 }] }], generationConfig: { responseMimeType: 'application/json' } }) })];
            case 6:
                r = _q.sent();
                return [4 /*yield*/, r.json()];
            case 7:
                d = _q.sent();
                text = ((_o = (_m = (_l = (_k = (_j = d === null || d === void 0 ? void 0 : d.candidates) === null || _j === void 0 ? void 0 : _j[0]) === null || _k === void 0 ? void 0 : _k.content) === null || _l === void 0 ? void 0 : _l.parts) === null || _m === void 0 ? void 0 : _m[0]) === null || _o === void 0 ? void 0 : _o.text) || '{}';
                data = {};
                try {
                    data = JSON.parse(text);
                }
                catch (_s) {
                    data = { enhancedPrompt: text };
                }
                return [2 /*return*/, json(res, r.ok ? 200 : 502, { success: r.ok, data: data, message: r.ok ? undefined : (_p = d === null || d === void 0 ? void 0 : d.error) === null || _p === void 0 ? void 0 : _p.message })];
            case 8:
                if (!(u.pathname === '/api/tiktok/extract' && req.method === 'POST')) return [3 /*break*/, 12];
                return [4 /*yield*/, body(req)];
            case 9:
                b = _q.sent();
                if (!process.env.TIKTOK_EXTRACTOR_URL)
                    return [2 /*return*/, json(res, 503, { success: false, error: 'No permitted media extraction provider is configured. Set TIKTOK_EXTRACTOR_URL on the server.' })];
                headers = { 'content-type': 'application/json' };
                if (process.env.TIKTOK_EXTRACTOR_TOKEN)
                    headers.authorization = "Bearer ".concat(process.env.TIKTOK_EXTRACTOR_TOKEN);
                return [4 /*yield*/, fetch(process.env.TIKTOK_EXTRACTOR_URL, { method: 'POST', headers: headers, body: JSON.stringify({ url: b.url }) })];
            case 10:
                r = _q.sent();
                _a = json;
                _b = [res, r.ok ? 200 : 502];
                return [4 /*yield*/, r.json()];
            case 11: return [2 /*return*/, _a.apply(void 0, _b.concat([_q.sent()]))];
            case 12:
                json(res, 404, { error: 'Not found' });
                return [3 /*break*/, 14];
            case 13:
                e_2 = _q.sent();
                json(res, 500, { success: false, error: e_2.message || 'Server error' });
                return [3 /*break*/, 14];
            case 14: return [2 /*return*/];
        }
    });
}); });
server.listen(port, function () { return console.log("API server listening on ".concat(port)); });
