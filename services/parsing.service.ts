import api from './api';

export interface ParsingRule {
    _id: string;
    type: 'CITY' | 'LOCATION' | 'TYPE';
    value: string;
    category?: string;
}

export const parsingService = {
    getRules: async () => {
        const response = await api.get('/public/parsing-rules');
        return response.data;
    },

    processOCR: async (imageUri: string) => {
        const formData = new FormData();
        const filename = imageUri.split('/').pop() || 'image.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image`;

        formData.append('image', {
            uri: imageUri,
            name: filename,
            type
        } as any);

        const response = await api.post('/intake/ocr', formData, {
            timeout: 120000, // 2 minutes for OCR
        });
        return response.data;
    },

    processZip: async (fileUri: string, fileName: string) => {
        const formData = new FormData();
        formData.append('file', {
            uri: fileUri,
            name: fileName,
            type: 'application/zip'
        } as any);

        const response = await api.post('/intake/zip', formData, {
            timeout: 120000, 
        });
        return response.data;
    },

    createIntake: async (content: string, source: string = 'Mobile App') => {
        const response = await api.post('/intake', { content, source });
        return response.data;
    },

    processPdf: async (fileUri: string, fileName: string) => {
        const formData = new FormData();
        formData.append('file', {
            uri: fileUri,
            name: fileName,
            type: 'application/pdf'
        } as any);

        const response = await api.post('/intake/pdf', formData, {
            timeout: 120000,
        });
        return response.data;
    }
};


