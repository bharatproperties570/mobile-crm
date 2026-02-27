import JSZip from 'jszip';
import * as FileSystem from 'expo-file-system';
import { parseDealContent } from './dealParser';

export interface ImportedMessage {
    id: string;
    source: string;
    content: string;
    receivedAt: string;
    metadata?: any;
}

/**
 * Parses a WhatsApp Export .zip file (Expo version)
 * @param uri - The local URI of the picked ZIP file
 * @returns Array of imported messages
 */
export const parseWhatsAppZip = async (uri: string): Promise<ImportedMessage[]> => {
    try {
        // Read file as base64
        const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
        });

        const zip = new JSZip();
        const contents = await zip.loadAsync(base64, { base64: true });

        // Find _chat.txt
        const chatFile = Object.values(contents.files).find(f =>
            !f.dir &&
            f.name.toLowerCase().endsWith('.txt') &&
            !f.name.startsWith('__MACOSX') &&
            !f.name.split('/').pop().startsWith('.')
        );

        if (!chatFile) {
            throw new Error('No valid .txt chat file found in the ZIP archive.');
        }

        const text = await chatFile.async('string');
        const lines = text.split(/\r?\n/);
        const parsedItems: ImportedMessage[] = [];

        // WhatsApp timestamp regex: [10/12/22, 10:45:30 AM] Name: Message OR 10/12/22, 10:45 AM - Name: Message
        const timestampRegex = /^(\[?(\d{1,4}[-./]\d{1,2}[-./]\d{2,4}),?\s+(\d{1,2}:\d{2}(:\d{2})?(\s?[APap][Mm])?)\]?)(?:\s-\s|\s)(.+?):/;

        lines.forEach(line => {
            line = line.replace(/[\u200e\u200f]/g, ""); // Remove hidden characters
            const match = line.match(timestampRegex);

            if (match) {
                const sender = match[6];
                const headerEndIndex = line.indexOf(sender + ':');
                let message = '';

                if (headerEndIndex !== -1) {
                    message = line.substring(headerEndIndex + sender.length + 1).trim();
                }

                if (!message ||
                    message.includes('Messages to this chat are now secured') ||
                    message.includes('created this group') ||
                    message.includes('added you') ||
                    message.includes('changed to') ||
                    message.includes('Media omitted')) {
                    return;
                }

                parsedItems.push({
                    id: Math.random().toString(36).substr(2, 9),
                    source: 'WhatsApp',
                    content: `${sender}: ${message}`,
                    receivedAt: new Date().toISOString(),
                    metadata: { sender, originalTimestamp: match[1] }
                });
            } else {
                if (parsedItems.length > 0 && line.trim()) {
                    parsedItems[parsedItems.length - 1].content += `\n${line}`;
                }
            }
        });

        return parsedItems.reverse();

    } catch (error: any) {
        console.error('WhatsApp Parse Error:', error);
        throw new Error('Failed to parse WhatsApp file: ' + error.message);
    }
};
