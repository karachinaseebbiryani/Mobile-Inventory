// Keep product entitlements in one place so plans can be changed without
// rewriting login or UI code.
const PLAN_MODULES = Object.freeze({
    standard: Object.freeze(['onlineStore']),
    premium: Object.freeze(['posOperations']),
    enterprise: Object.freeze(['onlineStore', 'posOperations'])
});

const PLAN_LABELS = Object.freeze({
    standard: 'Standard',
    premium: 'Premium',
    enterprise: 'Enterprise / Overall'
});

const normalizePlan = (plan) => {
    const value = String(plan || 'enterprise').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(PLAN_MODULES, value) ? value : null;
};

const getPlanEntitlements = (plan) => {
    const normalized = normalizePlan(plan) || 'enterprise';
    return {
        key: normalized,
        label: PLAN_LABELS[normalized],
        modules: [...PLAN_MODULES[normalized]]
    };
};

module.exports = { PLAN_MODULES, PLAN_LABELS, normalizePlan, getPlanEntitlements };
