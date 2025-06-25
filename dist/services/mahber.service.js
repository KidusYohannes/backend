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
exports.deleteMahber = exports.updateMahber = exports.getMahberById = exports.getMahbersByUser = exports.createMahberWithContributionTerm = exports.createMahber = void 0;
const mahber_model_1 = require("../models/mahber.model");
const mahber_contribution_term_model_1 = require("../models/mahber_contribution_term.model");
const db_1 = __importDefault(require("../config/db"));
const createMahber = (mahber) => __awaiter(void 0, void 0, void 0, function* () {
    const created = yield mahber_model_1.Mahber.create(mahber);
    return created.toJSON();
});
exports.createMahber = createMahber;
// Accepts a single payload with both Mahber and initial contribution term data
const createMahberWithContributionTerm = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    return yield db_1.default.transaction((t) => __awaiter(void 0, void 0, void 0, function* () {
        // Extract Mahber fields
        const mahberFields = {
            name: payload.name,
            created_by: payload.created_by,
            desccription: payload.desccription,
            type: payload.type,
            contribution_unit: payload.contribution_unit,
            contribution_frequency: payload.contribution_frequency,
            contribution_amount: payload.contribution_amount,
            contribution_start_date: payload.effective_from,
            affiliation: payload.affiliation
        };
        // Create Mahber
        const mahber = yield mahber_model_1.Mahber.create(mahberFields, { transaction: t });
        // Extract ContributionTerm fields
        const termFields = {
            mahber_id: mahber.id,
            amount: payload.contribution_amount,
            frequency: payload.contribution_frequency,
            unit: payload.contribution_unit,
            effective_from: payload.effective_from,
            status: 'active'
        };
        // Create first contribution term for this Mahber
        const term = yield mahber_contribution_term_model_1.MahberContributionTerm.create(termFields, { transaction: t });
        // Optionally, update Mahber with the term info if you want to keep it in sync
        // await mahber.update({
        //   contribution_unit: term.unit,
        //   contribution_frequency: term.frequency,
        //   contribution_amount: term.amount,
        //   contribution_start_date: term.effective_from
        // }, { transaction: t });
        return { mahber, contributionTerm: term };
    }));
});
exports.createMahberWithContributionTerm = createMahberWithContributionTerm;
const getMahbersByUser = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const mahbers = yield mahber_model_1.Mahber.findAll({ where: { created_by: userId } });
    return mahbers.map(m => m.toJSON());
});
exports.getMahbersByUser = getMahbersByUser;
const getMahberById = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const mahber = yield mahber_model_1.Mahber.findByPk(id);
    return mahber ? mahber.toJSON() : undefined;
});
exports.getMahberById = getMahberById;
const updateMahber = (id, updated, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const mahber = yield mahber_model_1.Mahber.findOne({ where: { id, created_by: userId } });
    if (!mahber)
        return undefined;
    yield mahber.update(updated);
    return mahber.toJSON();
});
exports.updateMahber = updateMahber;
const deleteMahber = (id, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const deleted = yield mahber_model_1.Mahber.destroy({ where: { id, created_by: userId } });
    return deleted > 0;
});
exports.deleteMahber = deleteMahber;
