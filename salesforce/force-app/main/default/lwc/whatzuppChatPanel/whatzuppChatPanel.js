import { LightningElement, api, track, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

// ─── Apex Controller Methods ───
import getMessages from '@salesforce/apex/WhatzuppChatController.getMessages';
import getMessagesByPhone from '@salesforce/apex/WhatzuppChatController.getMessagesByPhone';
import createOutboundMessage from '@salesforce/apex/WhatzuppChatController.createOutboundMessage';

// ─── Schema Imports ───
import LEAD_PHONE from '@salesforce/schema/Lead.Phone';
import LEAD_MOBILE from '@salesforce/schema/Lead.MobilePhone';
import LEAD_NAME from '@salesforce/schema/Lead.Name';
import CONTACT_PHONE from '@salesforce/schema/Contact.Phone';
import CONTACT_MOBILE from '@salesforce/schema/Contact.MobilePhone';
import CONTACT_NAME from '@salesforce/schema/Contact.Name';
import ACCOUNT_PHONE from '@salesforce/schema/Account.Phone';
import ACCOUNT_NAME from '@salesforce/schema/Account.Name';

// ─── Vercel API URL (used ONLY for sending — never for reading) ───
const DEFAULT_HTTPS_APP_URL = 'https://whatzupp-mcp.vercel.app';


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
        emojis: ['📱','💻','⌨️','🖥️','🖨️','📷','📹','📞','☎️','📺','📻','🎙️','⏰','⌚','📡','🔋','💡','💵','💰','💳','✉️','📧','📦','📋','📝','✏️','📌','📎','🔑','🔒']
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
    @track contactPhone = '';
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

    // ─── Apex polling timer ───
    _pollTimer = null;

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
                this.contactPhone = phone.replace(/[^0-9]/g, '');
            }
            const name = getFieldValue(data, LEAD_NAME) || 
                         getFieldValue(data, CONTACT_NAME) || 
                         getFieldValue(data, ACCOUNT_NAME);
            if (name) {
                this.contactName = name;
            }
            // Load messages from Salesforce via Apex
            this.loadMessagesFromApex();
        }
        if (error) {
            console.error('[WhatzuppChat] Error loading record:', error);
        }
    }

    connectedCallback() {
        // Set Vercel URL and load cached token
        this.settingsAppUrl = DEFAULT_HTTPS_APP_URL;
        try {
            const savedUrl = localStorage.getItem('whatzupp_app_url');
            if (savedUrl) this.settingsAppUrl = savedUrl;
            const savedToken = localStorage.getItem('whatzupp_access_token');
            if (savedToken) this.settingsAccessToken = savedToken;
        } catch (e) {
            // localStorage may not be available
        }

        // Load messages if recordId is already available
        if (this.recordId) {
            this.loadMessagesFromApex();
        }

        // Poll for new messages via Apex every 5 seconds
        // (Platform Events would be ideal but the org hit its custom object limit)
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this._pollTimer = setInterval(() => {
            if (this.contactPhone && !this.isSending && !this.isLoading) {
                this._pollMessagesFromApex();
            }
        }, 5000);
    }

    disconnectedCallback() {
        if (this._pollTimer) {
            clearInterval(this._pollTimer);
        }
    }

    // ════════════════════════════════════════
    // ─── APEX POLLING (silent refresh) ───
    // ════════════════════════════════════════

    async _pollMessagesFromApex() {
        try {
            let records = [];
            if (this.recordId && this.objectApiName) {
                records = await getMessages({
                    recordId: this.recordId,
                    objectApiName: this.objectApiName
                });
            }
            if ((!records || records.length === 0) && this.contactPhone) {
                const cleanPhone = this.contactPhone.replace(/[^0-9]/g, '');
                records = await getMessagesByPhone({ phone: cleanPhone });
            }

            if (records && records.length > 0) {
                const formatted = records.map(r => this._formatMessageItem(r));
                // Only update if message count changed (to avoid unnecessary re-renders)
                const lastOld = this.messages.length > 0 ? this.messages[this.messages.length - 1].id : null;
                const lastNew = formatted.length > 0 ? formatted[formatted.length - 1].id : null;
                if (formatted.length !== this.messages.length || lastOld !== lastNew) {
                    this.messages = formatted;
                    this.scrollToBottom();
                }
            }
        } catch (e) {
            // Silent catch — don't show errors for background polling
        }
    }

    // ════════════════════════════════════════
    // ─── GETTERS ───
    // ════════════════════════════════════════

    get headerTitle() {
        if (this.contactName && this.contactPhone) {
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
    // ─── MESSAGES (Apex-based) ───
    // ════════════════════════════════════════

    _formatMessageItem(m) {
        // Handle both Apex record format (field API names) and plain object format
        const contentText = m.Content__c || m.content || '';
        const direction = m.Direction__c || m.direction || 'INBOUND';
        const timestamp = m.Timestamp__c || m.timestamp || new Date().toISOString();
        const messageId = m.Message_Id__c || m.Id || m.id || ('msg-' + Date.now());
        const status = m.Status__c || m.status || 'SENT';

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
        const isOutbound = direction === 'OUTBOUND';
        const formattedTime = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return {
            id: messageId,
            content: contentText,
            displayContent,
            formattedTime,
            timestamp,
            direction,
            status,
            isOutbound,
            bubbleClass: `msg-bubble ${isOutbound ? 'msg-outbound' : 'msg-inbound'}`,
            isImage,
            isVideo,
            isDocument,
            isText,
            hasText,
            mediaUrl,
            fileName,
        };
    }

    /**
     * Load messages from Salesforce via Apex controller.
     * Primary method: query by recordId (Lead__c / Contact__c / Account__c).
     * Fallback: query by phone number if no record relationship found.
     */
    async loadMessagesFromApex() {
        this.isLoading = true;
        try {
            let records = [];

            // Primary: query by record relationship
            if (this.recordId && this.objectApiName) {
                records = await getMessages({ 
                    recordId: this.recordId, 
                    objectApiName: this.objectApiName 
                });
            }

            // Fallback: if no records found by relationship, try by phone
            if ((!records || records.length === 0) && this.contactPhone) {
                const cleanPhone = this.contactPhone.replace(/[^0-9]/g, '');
                records = await getMessagesByPhone({ phone: cleanPhone });
            }

            if (records && records.length > 0) {
                this.messages = records.map(r => this._formatMessageItem(r));
            } else {
                // No messages found — show empty state (never dummy data)
                this.messages = [];
            }
        } catch (error) {
            console.error('[WhatzuppChat] Apex getMessages error:', error);
            this.messages = [];
            this.showToast('Error', 'Failed to load messages: ' + (error.body?.message || error.message || 'Unknown error'), 'error');
        } finally {
            this.isLoading = false;
            this.scrollToBottom();
        }
    }

    // ════════════════════════════════════════
    // ─── SEND MESSAGE ───
    // ════════════════════════════════════════

    handleInputChange(event) {
        this.newMessageText = event.target.value;
    }

    handleKeyUp(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.handleSend();
        }
    }

    async handleSend() {
        if (!this.newMessageText || !this.newMessageText.trim()) return;

        const textToSend = this.newMessageText.trim();
        this.newMessageText = '';
        this.isSending = true;

        // Optimistic UI: show message immediately
        const tempId = 'temp-' + Date.now();
        const newMsg = {
            id: tempId,
            content: textToSend,
            displayContent: textToSend,
            timestamp: new Date().toISOString(),
            formattedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            direction: 'OUTBOUND',
            isOutbound: true,
            isText: true,
            hasText: true,
            isImage: false,
            isVideo: false,
            isDocument: false,
            bubbleClass: 'msg-bubble msg-outbound'
        };

        this.messages = [...this.messages, newMsg];
        this.scrollToBottom();

        let wamid = null;

        try {
            // Step 1: Send via Vercel → WhatsApp Meta API
            const endpoint = `${this.appBaseUrl}/api/send-message`;
            const res = await fetch(endpoint, {
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

            if (res.ok) {
                const data = await res.json();
                wamid = data?.data?.messages?.[0]?.id || null;
            }
        } catch (e) {
            console.warn('[WhatzuppChat] Vercel send failed (message may still be queued):', e);
        }

        try {
            // Step 2: Create/Upsert record in Salesforce via Apex (guaranteed persistence)
            const messageId = wamid || ('lwc-' + Date.now());
            await createOutboundMessage({
                phone: this.contactPhone,
                content: textToSend,
                messageId: messageId,
                recordId: this.recordId,
                objectApiName: this.objectApiName
            });

            // Refresh from Salesforce to get the real record
            await this.loadMessagesFromApex();
        } catch (apexError) {
            console.error('[WhatzuppChat] Apex createOutboundMessage failed:', apexError);
            this.showToast('Warning', 'Message sent to WhatsApp but Salesforce record creation failed.', 'warning');
        } finally {
            this.isSending = false;
        }
    }

    handleRefresh() {
        this.loadMessagesFromApex();
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
            if (this.settingsAccessToken) {
                localStorage.setItem('whatzupp_access_token', this.settingsAccessToken.trim());
            }
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
            const res = await fetch(endpoint, {
                headers: this._getHeaders()
            });
            if (!res.ok) {
                throw new Error(`Templates HTTP ${res.status}`);
            }
            const data = await res.json();
            const rawTemplates = data.templates || data.data || [];
            this.templates = rawTemplates.map(t => {
                const bodyComp = (t.components || []).find(c => c.type === 'BODY');
                return {
                    ...t,
                    bodyPreview: bodyComp ? bodyComp.text.slice(0, 120) + (bodyComp.text.length > 120 ? '...' : '') : 'No body text',
                    categoryClass: `template-category cat-${(t.category || 'UTILITY').toLowerCase()}`,
                    isSelected: false,
                };
            });
        } catch (e) {
            console.error('Template fetch error:', e);
            this.templatesError = e.message || 'Failed to load templates';
        } finally {
            this.templatesLoading = false;
        }
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
        const displayText = `📋 ${bodyText}`;
        const newMsg = {
            id: 'tpl-' + Date.now(),
            content: displayText,
            displayContent: displayText,
            timestamp: new Date().toISOString(),
            formattedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            direction: 'OUTBOUND',
            isOutbound: true,
            isText: true,
            hasText: true,
            isImage: false,
            isVideo: false,
            isDocument: false,
            bubbleClass: 'msg-bubble msg-outbound'
        };
        this.messages = [...this.messages, newMsg];
        this.scrollToBottom();

        let wamid = null;

        try {
            // Step 1: Send template via Vercel → WhatsApp Meta API
            const endpoint = `${this.appBaseUrl}/api/send-whatsapp`;
            const res = await fetch(endpoint, {
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

            if (res.ok) {
                const data = await res.json();
                wamid = data?.data?.messages?.[0]?.id || data?.messageId || null;
            }
        } catch (e) {
            console.error('Template send error:', e);
        }

        try {
            // Step 2: Create/Upsert record in Salesforce via Apex
            const messageId = wamid || ('tpl-lwc-' + Date.now());
            const templateContent = `[Template: ${tpl.name}] ${bodyText}`;
            await createOutboundMessage({
                phone: this.contactPhone,
                content: templateContent,
                messageId: messageId,
                recordId: this.recordId,
                objectApiName: this.objectApiName
            });

            // Refresh from Salesforce
            await this.loadMessagesFromApex();
        } catch (apexError) {
            console.error('[WhatzuppChat] Apex createOutboundMessage (template) failed:', apexError);
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
                headers: this._getHeaders({ 'Content-Type': 'application/json', 'X-Workspace-Id': 'salescloud-ws-1' }),
                body: JSON.stringify({
                    to: this.contactPhone,
                    message: '',
                    workspaceId: 'salescloud-ws-1',
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
