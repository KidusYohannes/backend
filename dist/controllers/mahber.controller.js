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
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeMahiber = exports.editMahiber = exports.getMahiber = exports.getMyMahibers = exports.addMahiber = void 0;
const mahber_service_1 = require("../services/mahber.service");
const addMahiber = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    try {
        // Always use the authenticated user as the creator
        const payload = Object.assign(Object.assign({}, req.body), { created_by: req.user.id });
        const { mahber, contributionTerm } = yield (0, mahber_service_1.createMahberWithContributionTerm)(payload);
        res.status(201).json({ mahber, contributionTerm });
    }
    catch (err) {
        res.status(400).json({ message: err.message || 'Failed to create mahber' });
    }
});
exports.addMahiber = addMahiber;
const getMyMahibers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        res.status(401).json({ message: 'Unauthorized' });
    }
    else {
        const mahibers = yield (0, mahber_service_1.getMahbersByUser)(req.user.id);
        res.json(mahibers);
    }
});
exports.getMyMahibers = getMyMahibers;
const getMahiber = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    const mahiber = yield (0, mahber_service_1.getMahberById)(Number(req.params.id));
    if (!mahiber || mahiber.created_by !== req.user.id) {
        res.status(404).json({ message: 'Mahiber not found' });
        return;
    }
    res.json(mahiber);
});
exports.getMahiber = getMahiber;
const editMahiber = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    const mahiber = yield (0, mahber_service_1.getMahberById)(Number(req.params.id));
    if (!mahiber || mahiber.created_by !== req.user.id) {
        res.status(404).json({ message: 'Mahiber not found or not authorized' });
        return;
    }
    try {
        const updated = yield (0, mahber_service_1.updateMahber)(Number(req.params.id), req.body, req.user.id);
        res.json(updated);
    }
    catch (err) {
        res.status(400).json({ message: err.message || 'Failed to update mahiber' });
    }
});
exports.editMahiber = editMahiber;
const removeMahiber = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    const mahiber = yield (0, mahber_service_1.getMahberById)(Number(req.params.id));
    if (!mahiber || mahiber.created_by !== req.user.id) {
        res.status(404).json({ message: 'Mahiber not found or not authorized' });
        return;
    }
    const deleted = yield (0, mahber_service_1.deleteMahber)(Number(req.params.id), req.user.id);
    if (!deleted) {
        res.status(404).json({ message: 'Mahiber not found' });
        return;
    }
    res.status(204).send();
});
exports.removeMahiber = removeMahiber;
