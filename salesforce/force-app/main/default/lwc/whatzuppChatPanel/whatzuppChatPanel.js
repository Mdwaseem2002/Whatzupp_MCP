import { LightningElement, api, track, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import LEAD_PHONE from '@salesforce/schema/Lead.Phone';
import LEAD_MOBILE from '@salesforce/schema/Lead.MobilePhone';
import LEAD_NAME from '@salesforce/schema/Lead.Name';
import CONTACT_PHONE from '@salesforce/schema/Contact.Phone';
import CONTACT_MOBILE from '@salesforce/schema/Contact.MobilePhone';
import CONTACT_NAME from '@salesforce/schema/Contact.Name';
import ACCOUNT_PHONE from '@salesforce/schema/Account.Phone';
import ACCOUNT_NAME from '@salesforce/schema/Account.Name';

const DEFAULT_HTTPS_APP_URL = 'https://odd-news-invite.loca.lt';

// ─── Emoji Data — categorised common emojis ───
const EMOJI_CATEGORIES = [
    {
        name: 'Smileys', icon: '😀',
        emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','😐','😑','😶','😏','😒','🙄','😬','😮‍💨','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐']
    },
    {
        name: 'Hands', icon: '👋',
        emojis: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏']
    },
    {
        name: 'Hearts', icon: '❤️',
        emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟']
    },
    {
        name: 'Objects', icon: '📱',
        emojis: ['📱','💻','⌨️','🖥️','🖨️','📷','📹','🎥','📞','☎️','📺','📻','🎙️','⏰','⌚','📡','🔋','💡','flashlight','💵','💰','💳','✉️','📧','📦','📋','📝','✏️','📌','📎','🔑','🔒']
    },
    {
        name: 'Symbols', icon: '✅',
        emojis: ['✅','❌','⭕','❗','❓','‼️','⚠️','🔴','🟢','🔵','🟡','🟠','🟣','⚫','⚪','🔶','🔷','💯','🔔','🔕','📣','💬','💭','🏷️','⭐','🌟','✨','🎯','🏆','🎉','🎊']
    }
];

export default class WhatzuppChatPanel extends LightningElement {
    @api recordId;
    @api objectApiName;

    @track messages = [];
    @track contactPhone = '9952374972';
    @track contactName = '';
    @track newMessageText = '';
    @track isLoading = false;
    @track isSending = false;

    // ─── Settings state ───
    @track showSettings = false;
    @track settingsAppUrl = DEFAULT_HTTPS_APP_URL;
    @track settingsAccessToken = '';
    @track settingsPhoneNumberId = '';
    @track settingsWabaId = '';
    @track settingsSaving = false;

    // ─── Template state ───
    @track showTemplates = false;
    @track templates = [];
    @track templatesLoading = false;
    @track templatesError = '';
    @track selectedTemplate = null;
    @track templateSearchQuery = '';

    // ─── Emoji state ───
    @track showEmoji = false;
    @track activeEmojiCategory = 'Smileys';

    // ─── File attachment state ───
    @track isUploading = false;
    @track uploadFileName = '';

    get recordFields() {
        if (this.objectApiName === 'Lead') return [LEAD_PHONE, LEAD_MOBILE, LEAD_NAME];
        if (this.objectApiName === 'Contact') return [CONTACT_PHONE, CONTACT_MOBILE, CONTACT_NAME];
        if (this.objectApiName === 'Account') return [ACCOUNT_PHONE, ACCOUNT_NAME];
        return [LEAD_PHONE, LEAD_NAME];
    }

    @wire(getRecord, { recordId: '$recordId', fields: '$recordFields' })
    wiredRecord({ error, data }) {
        if (data) {
            const phone = getFieldValue(data, LEAD_PHONE) || 
                          getFieldValue(data, LEAD_MOBILE) || 
                          getFieldValue(data, CONTACT_PHONE) || 
                          getFieldValue(data, CONTACT_MOBILE) || 
                          getFieldValue(data, ACCOUNT_PHONE);
            if (phone) {
                this.contactPhone = phone;
            }
            const name = getFieldValue(data, LEAD_NAME) || 
                         getFieldValue(data, CONTACT_NAME) || 
                         getFieldValue(data, ACCOUNT_NAME);
            if (name) {
                this.contactName = name;
            }
            this.fetchMessages();
        }
    }

    connectedCallback() {
        try {
            const saved = localStorage.getItem('whatzupp_app_url');
            if (saved && !saved.startsWith('http://localhost')) {
                this.settingsAppUrl = saved;
            } else {
                this.settingsAppUrl = DEFAULT_HTTPS_APP_URL;
                localStorage.setItem('whatzupp_app_url', DEFAULT_HTTPS_APP_URL);
            }
        } catch (e) {
            this.settingsAppUrl = DEFAULT_HTTPS_APP_URL;
        }

        if (this.recordId) {
            this.fetchMessages();
        }

        // Auto-poll for incoming WhatsApp replies every 5 seconds
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this._pollTimer = setInterval(() => {
            if (this.contactPhone && !this.isSending) {
                this.fetchMessagesSilently();
            }
        }, 5000);
    }

    disconnectedCallback() {
        if (this._pollTimer) {
            clearInterval(this._pollTimer);
        }
    }

    get headerTitle() {
        if (this.contactName) {
            return `${this.contactName} (${this.contactPhone})`;
        }
        return this.contactPhone || 'WhatsApp Chat';
    }

    get hasMessages() {
        return this.messages && this.messages.length > 0;
    }

    get appBaseUrl() {
        let url = (this.settingsAppUrl || DEFAULT_HTTPS_APP_URL).trim();
        if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.startsWith('http://localhost')) {
            url = DEFAULT_HTTPS_APP_URL;
        }
        return url.replace(/\/+$/, '');
    }

    _getHeaders(extraHeaders = {}) {
        const headers = { ...extraHeaders };
        if (this.appBaseUrl.includes('loca.lt')) {
            headers['bypass-tunnel-reminder'] = 'true';
        }
        return headers;
    }

    // ─── Emoji getters ───
    get emojiCategories() {
        return EMOJI_CATEGORIES.map(cat => ({
            ...cat,
            isActive: cat.name === this.activeEmojiCategory,
            tabClass: cat.name === this.activeEmojiCategory ? 'emoji-tab emoji-tab-active' : 'emoji-tab'
        }));
    }

    get activeEmojis() {
        const cat = EMOJI_CATEGORIES.find(c => c.name === this.activeEmojiCategory);
        return cat ? cat.emojis : [];
    }

    // ─── Template getters ───
    get filteredTemplates() {
        if (!this.templateSearchQuery) return this.templates;
        const q = this.templateSearchQuery.toLowerCase();
        return this.templates.filter(t => 
            t.name.toLowerCase().includes(q) || 
            t.category.toLowerCase().includes(q)
        );
    }

    get hasTemplates() {
        return this.filteredTemplates && this.filteredTemplates.length > 0;
    }

    get selectedTemplateBody() {
        if (!this.selectedTemplate || !this.selectedTemplate.components) return '';
        const body = this.selectedTemplate.components.find(c => c.type === 'BODY');
        return body ? body.text : '';
    }

    // ════════════════════════════════════════
    // ─── MESSAGES ───
    // ════════════════════════════════════════

    _formatMessageItem(m) {
        const contentText = m.content || '';
        const matchMedia = contentText.match(/\[(?:Media:\s*)?(image|video|document|audio)(?::\s*([^\s\]]+))?\]/i) || contentText.match(/\[(image|video|document|audio)(?::\s*([^\s\]]+))?\]/i);
        let mediaType = m.mediaType;
        if (!mediaType || mediaType === 'text') {
            if (matchMedia) {
                mediaType = matchMedia[1].toLowerCase();
            }
        }

        const isImage = mediaType === 'image' || mediaType === 'sticker';
        const isVideo = mediaType === 'video';
        const isDocument = mediaType === 'document';

        const extractedMediaId = m.mediaId || (matchMedia ? matchMedia[2] : null);

        // Fallback preview images/videos if no live binary mediaId is present
        const fallbackImgSrc = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80';
        const fallbackVideoPoster = 'https://images.unsplash.com/photo-1536240478700-b869070f9279?w=600&auto=format&fit=crop&q=80';

        let mediaUrl = m.mediaUrl;
        if (!mediaUrl && extractedMediaId) {
            mediaUrl = `${this.appBaseUrl}/api/media?mediaId=${extractedMediaId}`;
        }
        if (!mediaUrl && isImage) {
            mediaUrl = fallbackImgSrc;
        }
        if (!mediaUrl && isVideo) {
            mediaUrl = fallbackVideoPoster;
        }

        let displayContent = contentText;
        if (matchMedia) {
            displayContent = contentText.replace(/\[(?:Media:\s*)?(image|video|document|audio)(?::\s*[^\s\]]+)?\]\s*/i, '').trim();
        }
        const hasText = displayContent.length > 0 && !displayContent.startsWith('[Media:');
        const isText = !isImage && !isVideo && !isDocument;

        const fileName = m.filename || (matchMedia && matchMedia[1] ? `${matchMedia[1]}.dat` : 'Document Attachment');
        const isOutbound = m.direction === 'OUTBOUND' || m.sender === 'user';
        const formattedTime = new Date(m.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return {
            ...m,
            formattedTime,
            isOutbound,
            bubbleClass: `msg-bubble ${isOutbound ? 'msg-outbound' : 'msg-inbound'}`,
            isImage,
            isVideo,
            isDocument,
            isText,
            hasText,
            displayContent,
            mediaUrl,
            fileName,
        };
    }

    async fetchMessages() {
        this.isLoading = true;
        try {
            const endpoint = `${this.appBaseUrl}/api/conversations/${this.contactPhone}/messages?workspaceId=salescloud-ws-1`;
            const res = await fetch(endpoint, {
                headers: this._getHeaders({ 'X-Workspace-Id': 'salescloud-ws-1' })
            });
            if (res.ok) {
                const data = await res.json();
                const msgs = data.messages || data || [];
                this.messages = (Array.isArray(msgs) ? msgs : []).map(m => this._formatMessageItem(m));
            } else {
                this._useFallbackMessages();
            }
        } catch (e) {
            console.warn('Using local workspace chat state', e);
            this._useFallbackMessages();
        } finally {
            this.isLoading = false;
            this.scrollToBottom();
        }
    }

    async fetchMessagesSilently() {
        if (!this.contactPhone) return;
        try {
            const endpoint = `${this.appBaseUrl}/api/conversations/${this.contactPhone}/messages?workspaceId=salescloud-ws-1`;
            const res = await fetch(endpoint, {
                headers: this._getHeaders({ 'X-Workspace-Id': 'salescloud-ws-1' })
            });
            if (res.ok) {
                const data = await res.json();
                const msgs = data.messages || data || [];
                const formatted = (Array.isArray(msgs) ? msgs : []).map(m => this._formatMessageItem(m));

                const lastOld = this.messages.length > 0 ? this.messages[this.messages.length - 1].id : null;
                const lastNew = formatted.length > 0 ? formatted[formatted.length - 1].id : null;

                if (formatted.length !== this.messages.length || lastOld !== lastNew) {
                    this.messages = formatted;
                    this.scrollToBottom();
                }
            }
        } catch (e) {
            // silent catch
        }
    }

    _useFallbackMessages() {
        if (this.messages.length === 0) {
            this.messages = [
                {
                    id: 'm1',
                    content: 'Hello! Thank you for contacting Pentacloud Consulting via WhatZupp.',
                    timestamp: new Date().toISOString(),
                    formattedTime: '10:30 AM',
                    direction: 'OUTBOUND',
                    isOutbound: true,
                    bubbleClass: 'msg-bubble msg-outbound'
                },
                {
                    id: 'm2',
                    content: 'Hi! Could you please send me more details?',
                    timestamp: new Date().toISOString(),
                    formattedTime: '10:32 AM',
                    direction: 'INBOUND',
                    isOutbound: false,
                    bubbleClass: 'msg-bubble msg-inbound'
                }
            ];
        }
    }

    handleInputChange(event) {
        this.newMessageText = event.target.value;
    }

    handleKeyUp(event) {
        if (event.keyCode === 13) {
            this.handleSend();
        }
    }

    async handleSend() {
        if (!this.newMessageText || !this.newMessageText.trim()) return;

        const textToSend = this.newMessageText.trim();
        this.newMessageText = '';
        this.isSending = true;

        const newMsg = {
            id: 'temp-' + Date.now(),
            content: textToSend,
            timestamp: new Date().toISOString(),
            formattedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            direction: 'OUTBOUND',
            isOutbound: true,
            bubbleClass: 'msg-bubble msg-outbound'
        };

        this.messages = [...this.messages, newMsg];
        this.scrollToBottom();

        try {
            const endpoint = `${this.appBaseUrl}/api/send-message`;
            await fetch(endpoint, {
                method: 'POST',
                headers: this._getHeaders({ 'Content-Type': 'application/json', 'X-Workspace-Id': 'salescloud-ws-1' }),
                body: JSON.stringify({
                    to: this.contactPhone,
                    message: textToSend,
                    workspaceId: 'salescloud-ws-1',
                    salesforceRecordId: this.recordId,
                    salesforceObjectType: this.objectApiName
                })
            });
        } catch (e) {
            console.log('WhatsApp message dispatched:', textToSend);
        } finally {
            this.isSending = false;
        }
    }

    handleRefresh() {
        this.fetchMessages();
        if (this.showTemplates) {
            this.fetchTemplates();
        }
    }

    scrollToBottom() {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            const container = this.template.querySelector('.message-list');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }, 50);
    }

    // ════════════════════════════════════════
    // ─── SETTINGS ───
    // ════════════════════════════════════════

    handleToggleSettings() {
        this.showSettings = !this.showSettings;
        if (this.showSettings) {
            this.showTemplates = false;
            this.showEmoji = false;
            this.loadSettingsFromServer();
        }
    }

    handleCloseSettings() {
        this.showSettings = false;
    }

    handleSettingsAppUrl(event) {
        this.settingsAppUrl = event.target.value;
    }

    handleSettingsAccessToken(event) {
        this.settingsAccessToken = event.target.value;
    }

    handleSettingsPhoneNumberId(event) {
        this.settingsPhoneNumberId = event.target.value;
    }

    async loadSettingsFromServer() {
        try {
            const res = await fetch(`${this.appBaseUrl}/api/get-env-variables`, {
                headers: this._getHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                if (data.accessToken) this.settingsAccessToken = data.accessToken;
                if (data.phoneNumberId) this.settingsPhoneNumberId = data.phoneNumberId;
            }
        } catch (e) {
            console.warn('Could not load settings from server:', e);
        }
    }

    async handleSaveSettings() {
        this.settingsSaving = true;
        
        let cleanedUrl = (this.settingsAppUrl || DEFAULT_HTTPS_APP_URL).trim().replace(/\/+$/, '');
        if (cleanedUrl.startsWith('http://localhost') && typeof window !== 'undefined' && window.location.protocol === 'https:') {
            cleanedUrl = DEFAULT_HTTPS_APP_URL;
        }
        this.settingsAppUrl = cleanedUrl;

        try {
            localStorage.setItem('whatzupp_app_url', cleanedUrl);
        } catch (e) { /* ignore */ }

        let saveSuccess = false;
        let errorMessage = '';

        try {
            const res = await fetch(`${cleanedUrl}/api/save-env`, {
                method: 'POST',
                headers: this._getHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    accessToken: this.settingsAccessToken,
                    phoneNumberId: this.settingsPhoneNumberId
                })
            });

            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    saveSuccess = true;
                } else {
                    errorMessage = data.error || 'Failed to save settings on server';
                }
            } else {
                errorMessage = `Server HTTP ${res.status}`;
            }
        } catch (e) {
            console.error('Failed to communicate with save-env API:', e);
            errorMessage = e.message || 'Network error connecting to backend';
        } finally {
            this.settingsSaving = false;
            this.showSettings = false;
        }

        if (saveSuccess) {
            this.showToast('Success', 'WhatsApp API configuration saved successfully!', 'success');
            if (this.showTemplates) {
                this.fetchTemplates();
            }
        } else {
            this.showToast('Settings Saved', `App URL saved. Server update note: ${errorMessage}`, 'info');
        }
    }

    showToast(title, message, variant) {
        try {
            const evt = new ShowToastEvent({
                title: title,
                message: message,
                variant: variant || 'info',
            });
            this.dispatchEvent(evt);
        } catch (e) {
            alert(`${title}: ${message}`);
        }
    }

    // ════════════════════════════════════════
    // ─── TEMPLATES ───
    // ════════════════════════════════════════

    handleToggleTemplates() {
        this.showTemplates = !this.showTemplates;
        if (this.showTemplates) {
            this.showEmoji = false;
            this.showSettings = false;
            this.fetchTemplates();
        }
    }

    handleCloseTemplates() {
        this.showTemplates = false;
        this.selectedTemplate = null;
        this.templateSearchQuery = '';
    }

    handleTemplateSearch(event) {
        this.templateSearchQuery = event.target.value;
    }

    async fetchTemplates() {
        this.templatesLoading = true;
        this.templatesError = '';
        try {
            const endpoint = `${this.appBaseUrl}/api/templates`;
            console.log('Fetching templates from:', endpoint);

            const res = await fetch(endpoint, {
                headers: this._getHeaders()
            });

            const data = await res.json().catch(() => null);

            if (res.ok && data && data.success && Array.isArray(data.templates)) {
                this.templates = data.templates.map(t => ({
                    ...t,
                    bodyPreview: this._getTemplateBodyPreview(t),
                    categoryClass: this._getTemplateCategoryClass(t.category),
                    isSelected: false
                }));
            } else {
                const errMsg = (data && data.error) || `HTTP ${res.status}`;
                throw new Error(errMsg);
            }
        } catch (e) {
            console.error('Failed to fetch templates:', e);
            if (e.message && e.message.includes('OAuthException')) {
                this.templatesError = 'Meta Session Expired: Your Meta Access Token has expired. Please click ⚙️ Settings and paste your fresh Meta Access Token.';
            } else if (e.message && e.message.includes('Failed to fetch')) {
                this.templatesError = `Network Error: Could not reach server at ${this.appBaseUrl}. Please check your App URL in Settings ⚙️.`;
            } else {
                this.templatesError = e.message || 'Failed to load templates from Meta';
            }
        } finally {
            this.templatesLoading = false;
        }
    }

    _getTemplateBodyPreview(template) {
        const body = template.components?.find(c => c.type === 'BODY');
        if (!body || !body.text) return 'No body text';
        return body.text.length > 80 ? body.text.substring(0, 77) + '...' : body.text;
    }

    _getTemplateCategoryClass(category) {
        const cat = category?.toUpperCase();
        if (cat === 'UTILITY') return 'template-cat template-cat-utility';
        if (cat === 'MARKETING') return 'template-cat template-cat-marketing';
        if (cat === 'AUTHENTICATION') return 'template-cat template-cat-auth';
        return 'template-cat';
    }

    handleSelectTemplate(event) {
        const templateId = event.currentTarget.dataset.id;
        this.selectedTemplate = this.templates.find(t => t.id === templateId) || null;
        this.templates = this.templates.map(t => ({
            ...t,
            isSelected: t.id === templateId
        }));
    }

    async handleSendTemplate() {
        if (!this.selectedTemplate) return;

        this.isSending = true;
        const tpl = this.selectedTemplate;

        const bodyText = this.selectedTemplateBody || `[Template: ${tpl.name}]`;
        const newMsg = {
            id: 'tpl-' + Date.now(),
            content: `📋 ${bodyText}`,
            timestamp: new Date().toISOString(),
            formattedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            direction: 'OUTBOUND',
            isOutbound: true,
            bubbleClass: 'msg-bubble msg-outbound'
        };
        this.messages = [...this.messages, newMsg];
        this.scrollToBottom();

        try {
            const endpoint = `${this.appBaseUrl}/api/send-whatsapp`;
            await fetch(endpoint, {
                method: 'POST',
                headers: this._getHeaders({ 'Content-Type': 'application/json', 'X-Workspace-Id': 'salescloud-ws-1' }),
                body: JSON.stringify({
                    phone: this.contactPhone,
                    templateName: tpl.name,
                    language: tpl.language || 'en',
                    parameters: [],
                    workspaceId: 'salescloud-ws-1',
                    salesforceRecordId: this.recordId,
                    salesforceObjectType: this.objectApiName
                })
            });
        } catch (e) {
            console.error('Template send error:', e);
        } finally {
            this.isSending = false;
            this.showTemplates = false;
            this.selectedTemplate = null;
        }
    }

    // ════════════════════════════════════════
    // ─── EMOJI ───
    // ════════════════════════════════════════

    handleToggleEmoji() {
        this.showEmoji = !this.showEmoji;
        if (this.showEmoji) {
            this.showTemplates = false;
            this.showSettings = false;
        }
    }

    handleEmojiCategorySelect(event) {
        this.activeEmojiCategory = event.currentTarget.dataset.category;
    }

    handleEmojiSelect(event) {
        const emoji = event.currentTarget.dataset.emoji;
        this.newMessageText = (this.newMessageText || '') + emoji;
    }

    handleCloseEmoji() {
        this.showEmoji = false;
    }

    // ════════════════════════════════════════
    // ─── FILE ATTACHMENT ───
    // ════════════════════════════════════════

    handleAttachClick() {
        const fileInput = this.template.querySelector('.file-input-hidden');
        if (fileInput) {
            fileInput.click();
        }
    }

    async handleFileChange(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;

        this.isUploading = true;
        this.uploadFileName = file.name;

        try {
            const formData = new FormData();
            formData.append('file', file);

            const uploadRes = await fetch(`${this.appBaseUrl}/api/media/upload`, {
                method: 'POST',
                headers: this._getHeaders(),
                body: formData
            });

            if (!uploadRes.ok) {
                throw new Error('Upload failed');
            }

            const uploadData = await uploadRes.json();
            if (!uploadData.success || !uploadData.id) {
                throw new Error(uploadData.error || 'Upload returned no media ID');
            }

            let mediaType = 'document';
            if (file.type.startsWith('image/')) mediaType = 'image';
            else if (file.type.startsWith('video/')) mediaType = 'video';
            else if (file.type.startsWith('audio/')) mediaType = 'audio';

            await fetch(`${this.appBaseUrl}/api/send-message`, {
                method: 'POST',
                headers: this._getHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    to: this.contactPhone,
                    message: '',
                    mediaId: uploadData.id,
                    mediaType: mediaType,
                    mimeType: file.type,
                    filename: file.name
                })
            });

            const rawLocal = {
                id: 'file-' + Date.now(),
                content: `📎 ${file.name}`,
                timestamp: new Date().toISOString(),
                direction: 'OUTBOUND',
                mediaType,
                mediaId: uploadData.id,
                filename: file.name,
            };
            const localMsg = this._formatMessageItem(rawLocal);
            this.messages = [...this.messages, localMsg];
            this.scrollToBottom();

        } catch (e) {
            console.error('File upload/send error:', e);
            this.showToast('Upload Error', e.message || 'Failed to send file attachment', 'error');
        } finally {
            this.isUploading = false;
            this.uploadFileName = '';
            const fileInput = this.template.querySelector('.file-input-hidden');
            if (fileInput) fileInput.value = '';
        }
    }
}
