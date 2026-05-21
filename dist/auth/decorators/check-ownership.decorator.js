"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckOwnership = exports.CHECK_OWNERSHIP_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.CHECK_OWNERSHIP_KEY = 'checkOwnership';
const CheckOwnership = (paramName = 'id') => (0, common_1.SetMetadata)(exports.CHECK_OWNERSHIP_KEY, paramName);
exports.CheckOwnership = CheckOwnership;
//# sourceMappingURL=check-ownership.decorator.js.map