"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMahber = exports.updateMahber = exports.getMahberById = exports.getMahbersByUser = exports.createMahber = void 0;
const db_1 = __importDefault(require("../config/db"));
const createMahber = (mahber) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield db_1.default.query(`INSERT INTO mahber 
      (name, created_by, desccription, type, contribution_unit, contribution_frequency, contribution_amount, affiliation, contribution_start_date, created_at)
     VALUES 
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     RETURNING *`, [
        mahber.name,
        mahber.created_by,
        mahber.desccription,
        mahber.type,
        mahber.contribution_unit,
        mahber.contribution_frequency,
        mahber.contribution_amount,
        mahber.affiliation,
        mahber.contribution_start_date
    ]);
    return result.rows[0];
});
exports.createMahber = createMahber;
const getMahbersByUser = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield db_1.default.query('SELECT * FROM mahber WHERE created_by = $1', [userId]);
    return result.rows;
});
exports.getMahbersByUser = getMahbersByUser;
const getMahberById = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield db_1.default.query('SELECT * FROM mahber WHERE id = $1', [id]);
    return result.rows[0];
});
exports.getMahberById = getMahberById;
const updateMahber = (id, updated, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield db_1.default.query(`UPDATE mahber SET
      name = COALESCE($1, name),
      desccription = COALESCE($2, desccription),
      type = COALESCE($3, type),
      contribution_unit = COALESCE($4, contribution_unit),
      contribution_frequency = COALESCE($5, contribution_frequency),
      contribution_amount = COALESCE($6, contribution_amount),
      affiliation = COALESCE($7, affiliation),
      contribution_start_date = COALESCE($8, contribution_start_date),
      updated_by = $9,
      updated_at = NOW()
     WHERE id = $10 AND created_by = $9
     RETURNING *`, [
        updated.name,
        updated.desccription,
        updated.type,
        updated.contribution_unit,
        updated.contribution_frequency,
        updated.contribution_amount,
        updated.affiliation,
        updated.contribution_start_date,
        userId,
        id
    ]);
    return result.rows[0];
});
exports.updateMahber = updateMahber;
const deleteMahber = (id, userId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const result = yield db_1.default.query('DELETE FROM mahber WHERE id = $1 AND created_by = $2', [id, userId]);
    return ((_a = result.rowCount) !== null && _a !== void 0 ? _a : 0) > 0;
});
exports.deleteMahber = deleteMahber;
