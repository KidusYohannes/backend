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
exports.getPeriodDetails = getPeriodDetails;
exports.formatDate = formatDate;
exports.isValidDate = isValidDate;
exports.getCurrentDate = getCurrentDate;
exports.getCurrentDateTime = getCurrentDateTime;
exports.getNextPeriodStartDate = getNextPeriodStartDate;
exports.getNextPeriodEndDate = getNextPeriodEndDate;
exports.getPreviousPeriodStartDate = getPreviousPeriodStartDate;
exports.getPreviousPeriodEndDate = getPreviousPeriodEndDate;
exports.getPeriodDates = getPeriodDates;
exports.getNextPeriodDates = getNextPeriodDates;
exports.getPreviousPeriodDates = getPreviousPeriodDates;
exports.getPeriodNumber = getPeriodNumber;
exports.getCurrentPeriodNumber = getCurrentPeriodNumber;
const date_fns_1 = require("date-fns");
const mahber_contribution_term_model_1 = require("../models/mahber_contribution_term.model");
function getPeriodDetails({ startDate, frequency, unit, referenceDate = new Date() }) {
    const start = typeof startDate === 'string' ? (0, date_fns_1.parseISO)(startDate) : startDate;
    const ref = typeof referenceDate === 'string' ? (0, date_fns_1.parseISO)(referenceDate) : referenceDate;
    let cursor = start;
    let periodNumber = 1;
    while ((0, date_fns_1.isBefore)((0, date_fns_1.add)(cursor, { [unit + 's']: frequency }), ref)) {
        cursor = (0, date_fns_1.add)(cursor, { [unit + 's']: frequency });
        periodNumber++;
    }
    const periodStart = cursor;
    const periodEnd = (0, date_fns_1.add)(cursor, { [unit + 's']: frequency });
    return {
        periodNumber,
        periodStart,
        periodEnd
    };
}
function formatDate(date, format = 'yyyy-MM-dd') {
    if (typeof date === 'string') {
        date = (0, date_fns_1.parseISO)(date);
    }
    return date.toISOString().split('T')[0]; // Simple YYYY-MM-DD format
}
function isValidDate(date) {
    if (typeof date === 'string') {
        date = (0, date_fns_1.parseISO)(date);
    }
    return !isNaN(date.getTime());
}
function getCurrentDate() {
    return new Date().toISOString().split('T')[0]; // Returns current date in YYYY-MM-DD format
}
function getCurrentDateTime() {
    return new Date().toISOString(); // Returns current date and time in ISO format
}
function getNextPeriodStartDate(startDate, frequency, unit) {
    const start = (0, date_fns_1.parseISO)(startDate);
    const nextStart = (0, date_fns_1.add)(start, { [unit + 's']: frequency });
    return nextStart.toISOString().split('T')[0]; // Returns next period start date in YYYY-MM-DD format
}
function getNextPeriodEndDate(startDate, frequency, unit) {
    const start = (0, date_fns_1.parseISO)(startDate);
    const nextStart = (0, date_fns_1.add)(start, { [unit + 's']: frequency });
    const nextEnd = (0, date_fns_1.add)(nextStart, { [unit + 's']: frequency });
    return nextEnd.toISOString().split('T')[0]; // Returns next period end date in YYYY-MM-DD format
}
function getPreviousPeriodStartDate(startDate, frequency, unit) {
    const start = (0, date_fns_1.parseISO)(startDate);
    const previousStart = (0, date_fns_1.add)(start, { [unit + 's']: -frequency });
    return previousStart.toISOString().split('T')[0]; // Returns previous period start date in YYYY-MM-DD format
}
function getPreviousPeriodEndDate(startDate, frequency, unit) {
    const start = (0, date_fns_1.parseISO)(startDate);
    const previousStart = (0, date_fns_1.add)(start, { [unit + 's']: -frequency });
    const previousEnd = (0, date_fns_1.add)(previousStart, { [unit + 's']: frequency });
    return previousEnd.toISOString().split('T')[0]; // Returns previous period end date in YYYY-MM-DD format
}
function getPeriodDates(startDate, frequency, unit) {
    const start = (0, date_fns_1.parseISO)(startDate);
    const end = (0, date_fns_1.add)(start, { [unit + 's']: frequency });
    return {
        start: start.toISOString().split('T')[0], // Returns period start date in YYYY-MM-DD format
        end: end.toISOString().split('T')[0] // Returns period end date in YYYY-MM-DD format
    };
}
function getNextPeriodDates(startDate, frequency, unit) {
    const start = (0, date_fns_1.parseISO)(startDate);
    const nextStart = (0, date_fns_1.add)(start, { [unit + 's']: frequency });
    const nextEnd = (0, date_fns_1.add)(nextStart, { [unit + 's']: frequency });
    return {
        start: nextStart.toISOString().split('T')[0], // Returns next period start date in YYYY-MM-DD format
        end: nextEnd.toISOString().split('T')[0] // Returns next period end date in YYYY-MM-DD format
    };
}
function getPreviousPeriodDates(startDate, frequency, unit) {
    const start = (0, date_fns_1.parseISO)(startDate);
    const previousStart = (0, date_fns_1.add)(start, { [unit + 's']: -frequency });
    const previousEnd = (0, date_fns_1.add)(previousStart, { [unit + 's']: frequency });
    return {
        start: previousStart.toISOString().split('T')[0], // Returns previous period start date in YYYY-MM-DD format
        end: previousEnd.toISOString().split('T')[0] // Returns previous period end date in YYYY-MM-DD format
    };
}
function getPeriodNumber(startDate, frequency, unit, referenceDate = new Date()) {
    const { periodNumber } = getPeriodDetails({
        startDate,
        frequency,
        unit,
        referenceDate
    });
    return periodNumber;
}
function calculatePeriods(start, end, unit, frequency) {
    switch (unit) {
        case 'day':
            return Math.floor((0, date_fns_1.differenceInDays)(end, start) / frequency);
        case 'week':
            return Math.floor((0, date_fns_1.differenceInWeeks)(end, start) / frequency);
        case 'month':
            return Math.floor((0, date_fns_1.differenceInMonths)(end, start) / frequency);
        case 'year':
            return Math.floor((0, date_fns_1.differenceInYears)(end, start) / frequency);
        default:
            throw new Error(`Unsupported unit: ${unit}`);
    }
}
function getCurrentPeriodNumber(mahber_id) {
    return __awaiter(this, void 0, void 0, function* () {
        const terms = yield mahber_contribution_term_model_1.MahberContributionTerm.findAll({
            where: { mahber_id },
            order: [['effective_from', 'ASC']]
        });
        if (terms.length === 0)
            throw new Error('No contribution terms found for this Mahber');
        let totalPeriods = 0;
        const now = new Date();
        for (let i = 0; i < terms.length; i++) {
            const term = terms[i];
            const nextTerm = terms[i + 1];
            const termStart = new Date(term.effective_from);
            const termEnd = nextTerm ? new Date(nextTerm.effective_from) : now;
            // Only count periods if termStart is before now
            if (termStart >= now)
                break;
            const periodCount = calculatePeriods(termStart, termEnd, term.unit, term.frequency);
            totalPeriods += periodCount;
        }
        return totalPeriods;
    });
}
