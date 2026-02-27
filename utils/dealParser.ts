/**
 * World-Class Real Estate Deal Parser 🌍 (Mobile Port)
 * 
 * Hierarchy of Extraction:
 * 1. City & Location (Context)
 * 2. Unit Number (Precise ID)
 * 3. Property Category (Res/Comm/Ind)
 * 4. Property Type (Plot/Flat/Showroom)
 * 5. Size (Standardized)
 * 6. Price (Normalized)
 * 7. Contact Info
 * 8. Intent (Strict Buyer vs Seller)
 */

export interface ParsedDeal {
    intent: 'BUYER' | 'SELLER' | 'LANDLORD' | 'TENANT';
    category: string;
    type: string;
    location: string;
    address: {
        city: string | null;
        sector: string | null;
        unitNumber: string | null;
        unitNo: string | null;
    };
    specs: {
        size: string | null;
        price: string | null;
    };
    remarks: string | null;
    contacts: Array<{
        mobile: string;
        name: string;
        role: string;
        isNew: boolean;
    }>;
    tags: string[];
    raw: string;
    confidence: 'High' | 'Medium' | 'Low';
    confidenceScore: number; // 0-100
}

export interface ParserConfig {
    cities?: string[];
    locations?: string[];
    types?: Record<string, string[]>;
}

const DEFAULT_PATTERNS = {
    CITY: /(chandigarh|mohali|zirakpur|panchkula|kharar|new chandigarh|derabassi)/i,
    LOCATION: /(?:sector|sec|sec-|sector-)\s?(\d+[a-z]?)|(aerocity|aero city)|(it city)|(eco city)|(jlpl)|(tdp)|(bestech)|(homeland)|(marbella)|(green lotus)|(escon arena)/i,
    UNIT_EXPLICIT: /\*?(?:plot|sco|dss|house|shop|booth|flat|scf)\s+(?:no\.?|number|#)\s*[:\-\s]?\s*([a-z0-9-]{1,10})\*?/i,
    UNIT_IMPLICIT: /\*?(?:plot|sco|dss|house|shop|booth|flat|scf)\s+([a-z0-9-]*\d+[a-z0-9-]*)\*?/i,
    UNIT_GENERIC: /\*?(?:unit|no\.?|#)\s?[-:]?\s?([a-z0-9-]{1,8})\*?/i,
    SIZE: /(\d+(\.\d+)?)\s?(kanal|marla|gaz|sqyd|sq\s?yd|sqft|sq\s?ft|bigha|acre)/i,
    PRICE: /(\d+(\.\d+)?)\s?(cr|crore|c\b|lac|lakh|l\b|k\b|thousand)/i,
    BHK: /(\d)\s?bhk/i,
    TYPE_KEYWORDS: {
        'Residential': ['flat', 'apartment', 'bhk', 'penthouse', 'floor', 'builder floor', 'studio', 'duplex', 'simplex', 'villa', 'kothi', 'house', 'independent house', 'bungalow', 'mansion', 'residence', 'plot', 'land', 'gaz', 'sqyd', 'kanal', 'marla', 'bigha', 'acre'],
        'Commercial': ['shop', 'showroom', 'booth', 'sco', 'scf', 'dss', 'bay shop', 'double storey', 'office', 'office space', 'retail', 'anchor store', 'food court', 'multiplex', 'hotel', 'restaurant', 'pub', 'bar', 'club', 'resort', 'commercial plot', 'commercial land', 'plaza', 'mall'],
        'Industrial': ['factory', 'shed', 'warehouse', 'godown', 'storage', 'cold storage', 'industrial plot', 'industrial land', 'industrial shed', 'plant', 'manufacturing unit', 'industry'],
        'Agricultural': ['farm', 'farm land', 'agricultural land', 'agriculture', 'khet', 'zameen', 'jameen', 'vadi', 'farmhouse', 'orchard', 'nursery'],
        'Institutional': ['school', 'college', 'university', 'campus', 'institute', 'coaching centre', 'education', 'hospital', 'nursing home', 'clinic', 'dispensary', 'labs', 'pathology', 'institutional plot', 'religious', 'temple', 'mandir', 'gurudwara', 'church']
    }
};

const normalizeText = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

const getEffectivePatterns = (config?: ParserConfig) => {
    if (!config) return DEFAULT_PATTERNS;

    const patterns = { ...DEFAULT_PATTERNS };
    if (config.cities && config.cities.length > 0) {
        patterns.CITY = new RegExp(`(${config.cities.join('|')})`, 'i');
    }
    if (config.locations && config.locations.length > 0) {
        const dynamicLocs = config.locations.filter(l => l.toLowerCase() !== 'sector').join('|');
        patterns.LOCATION = new RegExp(`(?:sector|sec|sec-|sector-)\\s?(\\d+[a-z]?)|(${dynamicLocs})`, 'i');
    }
    if (config.types) {
        patterns.TYPE_KEYWORDS = { ...DEFAULT_PATTERNS.TYPE_KEYWORDS, ...config.types };
    }
    return patterns;
};

const extractCity = (text: string, patterns: typeof DEFAULT_PATTERNS) => {
    const match = text.match(patterns.CITY);
    return match ? { value: match[0].toUpperCase(), match: match[0] } : null;
};

const extractLocation = (text: string, patterns: typeof DEFAULT_PATTERNS) => {
    const match = text.match(patterns.LOCATION);
    if (!match) return null;

    let value;
    if (match[1]) value = `Sector ${match[1].toUpperCase()}`;
    else value = match[0].replace(/\b\w/g, c => c.toUpperCase());

    return { value, match: match[0] };
};

const extractUnit = (text: string, patterns: typeof DEFAULT_PATTERNS) => {
    const explicitMatch = text.match(patterns.UNIT_EXPLICIT);
    if (explicitMatch && explicitMatch[1]) return { value: explicitMatch[1].toUpperCase(), match: explicitMatch[0] };

    const implicitMatch = text.match(patterns.UNIT_IMPLICIT);
    if (implicitMatch && implicitMatch[1]) return { value: implicitMatch[1].toUpperCase(), match: implicitMatch[0] };

    const genericMatch = text.match(patterns.UNIT_GENERIC);
    if (genericMatch && genericMatch[1]) return { value: genericMatch[1].toUpperCase(), match: genericMatch[0] };

    return null;
};

const extractSize = (text: string, patterns: typeof DEFAULT_PATTERNS) => {
    const match = text.match(patterns.SIZE);
    if (match) return { value: `${match[1]} ${match[3].replace(/\b\w/g, c => c.toUpperCase())}`, match: match[0] };
    return null;
};

const extractPrice = (text: string, patterns: typeof DEFAULT_PATTERNS) => {
    const match = text.match(patterns.PRICE);
    if (match) {
        let amount = parseFloat(match[1]);
        let unit = match[3].toLowerCase();
        let value;
        if (unit.startsWith('c')) value = `${amount} Cr`;
        else if (unit.startsWith('l')) value = `${amount} Lac`;
        else if (unit.startsWith('k') || unit.startsWith('t')) value = `${(amount / 100).toFixed(2)} Lac`;
        else value = match[0];
        return { value, match: match[0] };
    }
    return null;
};

const determineCategoryType = (text: string, patterns: typeof DEFAULT_PATTERNS) => {
    const bhkMatch = text.match(patterns.BHK);
    if (bhkMatch) return { category: 'Residential', type: `${bhkMatch[1]} BHK Flat`, match: bhkMatch[0] };

    for (const [catName, words] of Object.entries(patterns.TYPE_KEYWORDS)) {
        for (const word of words) {
            if (text.includes(word.toLowerCase())) {
                return { category: catName, type: word.replace(/\b\w/g, c => c.toUpperCase()), match: word };
            }
        }
    }
    return { category: 'Residential', type: 'Unknown', match: '' };
};

const extractContacts = (text: string) => {
    const tokenizedText = text.replace(/[^0-9+]/g, ' ');
    const potentialNumbers = tokenizedText.split(/\s+/);
    const matches: string[] = [];

    potentialNumbers.forEach(token => {
        if (!token) return;
        let cleaner = token;
        if (cleaner.startsWith('+91')) cleaner = cleaner.substring(3);
        else if (cleaner.startsWith('91') && cleaner.length === 12) cleaner = cleaner.substring(2);
        else if (cleaner.startsWith('0') && cleaner.length === 11) cleaner = cleaner.substring(1);

        if (cleaner.length === 10 && /^[6-9]\d{9}$/.test(cleaner)) {
            matches.push(cleaner);
        }
    });

    return [...new Set(matches)].map(phone => ({
        mobile: phone,
        name: 'Unknown',
        role: 'New Contact',
        isNew: true
    }));
};

const determineIntent = (text: string): 'BUYER' | 'SELLER' | 'LANDLORD' | 'TENANT' => {
    const t = text.toLowerCase();
    const buyerKeywords = ['want', 'need', 'require', 'looking for', 'urgent', 'buy', 'budget'];
    const sellerKeywords = ['available', 'sale', 'sell', 'inventory', 'offer', 'hot', 'fresh', 'resale', 'booking'];

    if (t.includes('want to sell')) return 'SELLER';
    if (t.includes('available for rent')) return 'LANDLORD';
    if (t.includes('want to rent')) return 'TENANT';

    let bScore = 0, sScore = 0;
    buyerKeywords.forEach(w => { if (t.includes(w)) bScore++; });
    sellerKeywords.forEach(w => { if (t.includes(w)) sScore++; });

    return bScore > sScore ? 'BUYER' : 'SELLER';
};

const determineTags = (text: string) => {
    const tags = [];
    if (text.includes('direct') || text.includes('party') || text.includes('owner')) tags.push('DIRECT');
    if (text.includes('client in hand') || text.includes('cih')) tags.push('CIH');
    if (text.includes('resale') || text.includes('secondary')) tags.push('RESALE');
    else if (text.includes('fresh') || text.includes('booking') || text.includes('launch') || text.includes('new')) tags.push('FRESH');
    if (text.includes('urgent') || text.includes('immediate') || text.includes('fire') || text.includes('hot')) tags.push('URGENT');
    if (text.includes('corner') || text.includes('park facing')) tags.push('PREMIUM');
    return tags;
};

export const parseDealContent = (originalText: string, config?: ParserConfig): ParsedDeal => {
    const patterns = getEffectivePatterns(config);
    let remainingText = originalText + "";
    const textLower = normalizeText(originalText);

    const consume = (matchString: string) => {
        if (!matchString) return;
        const regex = new RegExp(matchString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        remainingText = remainingText.replace(regex, '').replace(/\s{2,}/g, ' ').trim();
    };

    const cityResult = extractCity(textLower, patterns);
    if (cityResult) consume(cityResult.match);

    const locResult = extractLocation(textLower, patterns);
    if (locResult) consume(locResult.match);

    const unitResult = extractUnit(originalText, patterns);
    if (unitResult) consume(unitResult.match);

    const sizeResult = extractSize(originalText, patterns);
    if (sizeResult) consume(sizeResult.match);

    const priceResult = extractPrice(originalText, patterns);
    if (priceResult) {
        consume(priceResult.match);
        remainingText = remainingText.replace(/\b(price|rate|ask|demand)\b/gi, '').replace(/\s{2,}/g, ' ');
    }

    const catResult = determineCategoryType(textLower, patterns);
    if (catResult.match) consume(catResult.match);

    const contacts = extractContacts(originalText);
    contacts.forEach(c => consume(c.mobile));

    const intent = determineIntent(textLower);
    const tags = determineTags(textLower);

    let remarks = remainingText.replace(/^[,.\-\s]+/, '').replace(/[,.\-\s]+$/, '').trim();

    // Confidence Scoring Algorithm
    let score = 0;
    if (locResult) score += 30;
    if (unitResult) score += 30;
    if (priceResult) score += 15;
    if (sizeResult) score += 15;
    if (catResult.type !== 'Unknown') score += 10;

    let confidence: 'High' | 'Medium' | 'Low' = 'Low';
    if (score >= 70) confidence = 'High';
    else if (score >= 40) confidence = 'Medium';

    return {
        intent,
        category: catResult.category,
        type: catResult.type,
        location: (locResult?.value || cityResult?.value) || 'Unspecified',
        address: {
            city: cityResult?.value || null,
            sector: locResult?.value || null,
            unitNumber: unitResult?.value || null,
            unitNo: unitResult?.value || null
        },
        specs: {
            size: sizeResult?.value || null,
            price: priceResult?.value || null
        },
        remarks: remarks || null,
        contacts,
        tags,
        raw: originalText,
        confidence,
        confidenceScore: score
    };
};

export const splitIntakeMessage = (text: string): string[] => {
    if (!text) return [];
    const numberedListRegex = /(?:\r\n|\r|\n|^)\s*\d+[.)]\s+/g;
    const doubleNewlineRegex = /\n\s*\n/;

    let segments: string[] = [];
    if (numberedListRegex.test(text)) {
        const markedText = text.replace(numberedListRegex, (match) => `|SPLIT|${match}`);
        segments = markedText.split('|SPLIT|').map(s => s.replace(/^\s*\d+[.)]\s+/, '').trim());
    } else if (doubleNewlineRegex.test(text)) {
        segments = text.split(doubleNewlineRegex).map(s => s.trim());
    } else {
        segments = [text.trim()];
    }

    return segments.filter(s => s.length > 10);
};

