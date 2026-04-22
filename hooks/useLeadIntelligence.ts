import { useMemo } from 'react';

export const useLeadIntelligence = (lead: any, activities: any[] = []) => {
    return useMemo(() => {
        if (!lead) return null;

        const score = lead.intent_index || 50;
        const totalActs = activities.length;
        
        // Intensity Logic
        const purchaseIntent = {
            level: score >= 80 ? 'High' : score >= 50 ? 'Moderate' : 'Low',
            emoji: score >= 80 ? '🔥' : score >= 50 ? '🌤' : '❄',
            color: score >= 80 ? '#8B5CF6' : score >= 50 ? '#F59E0B' : '#64748B'
        };

        const closingProbability = {
            score: Math.min(score, 95),
            stages: [
                { label: 'Inquiry', prob: 25, status: 'completed' },
                { label: 'Shortlist', prob: 50, status: score >= 50 ? 'completed' : 'active' },
                { label: 'Site Visit', prob: 75, status: score >= 75 ? 'completed' : (score >= 50 ? 'active' : 'pending') },
                { label: 'Closing', prob: 100, status: score >= 90 ? 'active' : 'pending' }
            ]
        };

        const riskLevel = {
            status: totalActs === 0 ? 'High Risk' : (score < 40 ? 'At Risk' : 'Stable'),
            color: totalActs === 0 ? '#EF4444' : (score < 40 ? '#F59E0B' : '#10B981'),
            reason: totalActs === 0 ? 'No activity logged' : (score < 40 ? 'Low engagement' : 'Active interest')
        };

        const playbookAction = score >= 80 ? 'Prepare final offer & draft' : (totalActs < 2 ? 'Schedule introduction call' : 'Send property brochure');

        return {
            purchaseIntent,
            closingProbability,
            riskLevel,
            playbookAction,
            score
        };
    }, [lead, activities]);
};
