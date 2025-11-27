// Configuration
// Webhook URL is loaded from config.js


// Helper to get elements dynamically
function getChatElements() {
    return {
        chatBubble: document.getElementById('chat-bubble-btn'),
        chatWindow: document.getElementById('chat-window'),
        chatInput: document.getElementById('chat-input'),
        chatHistory: document.getElementById('chat-history'),
        sendBtn: document.getElementById('send-btn'),
        fileInput: document.getElementById('file-input'),
        confirmationPopup: document.getElementById('confirmation-popup')
    };
}

// Mobile Menu Toggle
function toggleMenu() {
    const nav = document.getElementById('main-nav');
    nav.classList.toggle('active');
}

// Load history and check cookie consent on init
window.addEventListener('DOMContentLoaded', () => {
    loadChatHistory();
    checkCookieConsent();
    initSessionId();

    // Restore Chat State
    if (sessionStorage.getItem('chatState') === 'open') {
        openChat();
    }
});

function initSessionId() {
    if (!sessionStorage.getItem('chatSessionId')) {
        sessionStorage.setItem('chatSessionId', crypto.randomUUID());
    }
}

function checkCookieConsent() {
    if (!sessionStorage.getItem('cookieConsentSeen')) {
        const popup = document.getElementById('cookie-popup');
        if (popup) {
            popup.style.display = 'flex';
        }
    }
}

function acceptCookies() {
    sessionStorage.setItem('cookieConsentSeen', 'true');
    const popup = document.getElementById('cookie-popup');
    if (popup) {
        popup.style.display = 'none';
    }
}

function loadChatHistory() {
    const { chatHistory } = getChatElements();
    if (!chatHistory) return;

    const history = JSON.parse(sessionStorage.getItem('chatHistory')) || [];
    history.forEach(msg => {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', msg.type); // 'user' or 'bot'
        msgDiv.innerHTML = msg.text; // Use innerHTML to support image tag
        chatHistory.appendChild(msgDiv);
    });
    scrollToBottom();
}

function saveChatHistory() {
    const { chatHistory } = getChatElements();
    if (!chatHistory) return;

    const messages = [];
    // Capture DOM elements.
    const msgElements = chatHistory.querySelectorAll('.message');
    msgElements.forEach(el => {
        messages.push({
            text: el.innerHTML, // Save innerHTML to keep image tag
            type: el.classList.contains('user') ? 'user' : 'bot'
        });
    });
    // messages is now [Oldest, ..., Newest] (DOM order)

    sessionStorage.setItem('chatHistory', JSON.stringify(messages));
}

function scrollToBottom() {
    const { chatHistory } = getChatElements();
    if (chatHistory) {
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }
}


let currentImageBase64 = null;

// Toggle Open/Close (Bubble Click)
function toggleChat() {
    const { chatWindow } = getChatElements();
    if (!chatWindow) return;

    const style = window.getComputedStyle(chatWindow);
    if (style.display === 'none') {
        openChat();
    } else {
        minimizeChat();
    }
}

function openChat() {
    const { chatWindow, chatBubble, chatInput } = getChatElements();
    if (chatWindow) chatWindow.style.display = 'flex';
    if (chatBubble) chatBubble.style.display = 'none';
    if (chatInput) chatInput.focus();
    sessionStorage.setItem('chatState', 'open');
}

function minimizeChat() {
    const { chatWindow, chatBubble } = getChatElements();
    if (chatWindow) chatWindow.style.display = 'none';
    if (chatBubble) chatBubble.style.display = 'flex';
    sessionStorage.setItem('chatState', 'closed');
}

// Confirmation Popup Logic
function confirmCloseChat() {
    const { confirmationPopup } = getChatElements();
    const history = JSON.parse(sessionStorage.getItem('chatHistory')) || [];

    if (history.length === 0) {
        minimizeChat();
    } else {
        if (confirmationPopup) confirmationPopup.style.display = 'flex';
    }
}

function cancelCloseChat() {
    const { confirmationPopup } = getChatElements();
    if (confirmationPopup) confirmationPopup.style.display = 'none';
}

function endChatSession() {
    const { chatHistory, confirmationPopup } = getChatElements();

    // Clear Session Storage
    sessionStorage.removeItem('chatHistory');
    sessionStorage.removeItem('chatSessionId');
    sessionStorage.setItem('chatState', 'closed');

    // Clear DOM History
    if (chatHistory) chatHistory.innerHTML = '';

    // Generate new Session ID for next time
    initSessionId();

    // Hide Popup and Chat
    if (confirmationPopup) confirmationPopup.style.display = 'none';
    minimizeChat();
}

// File Upload Logic
function handleFileSelect() {
    const { fileInput, chatInput } = getChatElements();
    if (!fileInput) return;

    const file = fileInput.files[0];

    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            currentImageBase64 = e.target.result;
            // Visual cue
            if (chatInput) {
                chatInput.placeholder = "Image attached. Type a message...";
                chatInput.focus();
            }
        };
        reader.readAsDataURL(file);
    }
}

// Send Message Logic
async function sendMessage() {
    const { chatInput, chatHistory, sendBtn, fileInput } = getChatElements();
    if (!chatInput) return;

    const messageText = chatInput.value.trim();

    if (messageText !== "" || currentImageBase64) {
        // 1. Create message element
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', 'user');

        if (currentImageBase64) {
            // Optional: Show a small preview or text
            msgDiv.innerHTML = (messageText ? messageText + "<br>" : "") + "<i>[Image Attached]</i>";
        } else {
            msgDiv.textContent = messageText;
        }

        // 2. Insert at the BOTTOM of the chat window (append)
        if (chatHistory) {
            chatHistory.appendChild(msgDiv);
            scrollToBottom();
        }

        // Save to session storage
        saveChatHistory();

        // 3. Clear input
        chatInput.value = "";

        // Disable input and button
        chatInput.disabled = true;
        if (sendBtn) sendBtn.disabled = true;

        // 4. Send to n8n Webhook
        if (N8N_WEBHOOK_URL) {
            try {
                const payload = {
                    message: messageText,
                    timestamp: new Date().toISOString(),
                    sessionId: sessionStorage.getItem('chatSessionId')
                };

                if (currentImageBase64) {
                    payload.image = currentImageBase64;
                }

                const response = await fetch(N8N_WEBHOOK_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
                console.log("Sent to n8n:", response.status);

                // Handle reply if JSON
                if (response.ok) {
                    const data = await response.json();
                    console.log("Received data from n8n:", data); // Debug log

                    const replyText = data.output || data.answer;

                    if (replyText) {
                        const botMsgDiv = document.createElement('div');
                        botMsgDiv.classList.add('message', 'bot'); // Ensure CSS exists for .bot
                        botMsgDiv.textContent = replyText;
                        if (chatHistory) {
                            chatHistory.appendChild(botMsgDiv);
                            scrollToBottom();
                        }
                        saveChatHistory();
                    }
                }

            } catch (error) {
                console.error("Error sending to n8n:", error);
            } finally {
                // Re-enable input
                chatInput.disabled = false;
                if (sendBtn) sendBtn.disabled = false;
                chatInput.focus();

                // Reset file upload
                currentImageBase64 = null;
                if (fileInput) fileInput.value = "";
                chatInput.placeholder = "Type a message...";
            }
        } else {
            console.log("n8n Webhook not configured yet. Message captured:", messageText);
            // Re-enable if no webhook
            chatInput.disabled = false;
            if (sendBtn) sendBtn.disabled = false;
            chatInput.focus();
        }
    }
}

// Allow pressing "Enter" to send
const { chatInput } = getChatElements();
if (chatInput) {
    chatInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            sendMessage();
        }
    });
} else {
    // Fallback if script runs before DOM (though it shouldn't with defer or bottom placement)
    // We can attach event listener via document delegation or just rely on getChatElements inside functions
    document.addEventListener('keypress', function (event) {
        if (event.target && event.target.id === 'chat-input' && event.key === 'Enter') {
            event.preventDefault();
            sendMessage();
        }
    });
}
