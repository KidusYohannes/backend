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
exports.unbanMember = exports.banMember = exports.respondToJoinRequest = exports.respondToInvite = exports.inviteMember = exports.requestToJoinMahber = exports.getAllMahbers = void 0;
const member_model_1 = require("../models/member.model");
const mahber_model_1 = require("../models/mahber.model");
const sequelize_1 = require("sequelize");
const getAllMahbers = () => __awaiter(void 0, void 0, void 0, function* () {
    return mahber_model_1.Mahber.findAll();
});
exports.getAllMahbers = getAllMahbers;
const requestToJoinMahber = (userId, edirId) => __awaiter(void 0, void 0, void 0, function* () {
    // Check if user is already in a mahber
    const existing = yield member_model_1.Member.findOne({ where: { member_id: userId, status: 'accepted' } });
    if (existing)
        throw new Error('User already in a mahber');
    // Check if already requested
    const pending = yield member_model_1.Member.findOne({ where: { member_id: userId, edir_id: edirId, status: 'requested' } });
    if (pending)
        throw new Error('Already requested');
    return member_model_1.Member.create({ member_id: userId, edir_id: edirId, role: 'member', status: 'requested' });
});
exports.requestToJoinMahber = requestToJoinMahber;
const inviteMember = (adminId, edirId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    // Only admin can invite
    const admin = yield member_model_1.Member.findOne({ where: { member_id: adminId, edir_id: edirId, role: 'admin', status: 'accepted' } });
    if (!admin)
        throw new Error('Only admin can invite');
    // Check if user is already in a mahber
    const existing = yield member_model_1.Member.findOne({ where: { member_id: userId, status: 'accepted' } });
    if (existing)
        throw new Error('User already in a mahber');
    return member_model_1.Member.create({ member_id: userId, edir_id: edirId, role: 'member', status: 'invited' });
});
exports.inviteMember = inviteMember;
const respondToInvite = (userId, edirId, accept) => __awaiter(void 0, void 0, void 0, function* () {
    const member = yield member_model_1.Member.findOne({ where: { member_id: userId, edir_id: edirId, status: 'invited' } });
    if (!member)
        throw new Error('No invite found');
    if (accept) {
        // Accept: set all other memberships to rejected/banned
        yield member_model_1.Member.update({ status: 'rejected' }, { where: { member_id: userId, status: { [sequelize_1.Op.ne]: 'invited' } } });
        member.status = 'accepted';
        yield member.save();
        return member;
    }
    else {
        member.status = 'rejected';
        yield member.save();
        return member;
    }
});
exports.respondToInvite = respondToInvite;
const respondToJoinRequest = (adminId, edirId, userId, accept) => __awaiter(void 0, void 0, void 0, function* () {
    // Only admin can accept/reject
    const admin = yield member_model_1.Member.findOne({ where: { member_id: adminId, edir_id: edirId, role: 'admin', status: 'accepted' } });
    if (!admin)
        throw new Error('Only admin can respond');
    const member = yield member_model_1.Member.findOne({ where: { member_id: userId, edir_id: edirId, status: 'requested' } });
    if (!member)
        throw new Error('No join request found');
    if (accept) {
        // Accept: set all other memberships to rejected/banned
        yield member_model_1.Member.update({ status: 'rejected' }, { where: { member_id: userId, status: { [sequelize_1.Op.ne]: 'requested' } } });
        member.status = 'accepted';
        yield member.save();
        return member;
    }
    else {
        member.status = 'rejected';
        yield member.save();
        return member;
    }
});
exports.respondToJoinRequest = respondToJoinRequest;
const banMember = (adminId, edirId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const admin = yield member_model_1.Member.findOne({ where: { member_id: adminId, edir_id: edirId, role: 'admin', status: 'accepted' } });
    if (!admin)
        throw new Error('Only admin can ban');
    const member = yield member_model_1.Member.findOne({ where: { member_id: userId, edir_id: edirId } });
    if (!member)
        throw new Error('Member not found');
    member.status = 'banned';
    yield member.save();
    return member;
});
exports.banMember = banMember;
const unbanMember = (adminId, edirId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const admin = yield member_model_1.Member.findOne({ where: { member_id: adminId, edir_id: edirId, role: 'admin', status: 'accepted' } });
    if (!admin)
        throw new Error('Only admin can unban');
    const member = yield member_model_1.Member.findOne({ where: { member_id: userId, edir_id: edirId, status: 'banned' } });
    if (!member)
        throw new Error('Member not found');
    member.status = 'accepted';
    yield member.save();
    return member;
});
exports.unbanMember = unbanMember;
