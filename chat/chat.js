
// ==========================================
// CONFIGURATION
// ==========================================

const params = new URLSearchParams(window.location.search);

const restaurantId = params.get("restaurant_id");

const restaurantName =
    params.get("restaurant_name") || "Your Restaurant";

const API_BASE_URL = (
    params.get("api") ||
    "https://restaurant-ai-waiter-api.onrender.com"
).replace(/\/+$/, "");

const SESSION_STORAGE_KEY =
    `servio_chat_session_${restaurantId}`;


// ==========================================
// ELEMENTS
// ==========================================

const restaurantNameElement =
    document.getElementById("restaurantName");

const sidebarRestaurantName =
    document.getElementById("sidebarRestaurantName");

const sidebarDescription =
    document.getElementById("sidebarDescription");

const welcomeSender =
    document.getElementById("welcomeSender");

const welcomeMessage =
    document.getElementById("welcomeMessage");

const statusText =
    document.getElementById("statusText");

const chatBody =
    document.getElementById("chatBody");

const messages =
    document.getElementById("messages");

const messageInput =
    document.getElementById("messageInput");

const sendBtn =
    document.getElementById("sendBtn");

const typingIndicator =
    document.getElementById("typingIndicator");

const connectionError =
    document.getElementById("connectionError");

const footerNote =
    document.getElementById("footerNote");


// ==========================================
// STATE
// ==========================================

let sessionId = null;

let sendingMessage = false;


// ==========================================
// RESTAURANT INFORMATION
// ==========================================

document.title = restaurantName + " | Servio AI";

restaurantNameElement.textContent = restaurantName;

sidebarRestaurantName.textContent = restaurantName;

welcomeSender.textContent = restaurantName + " AI";

sidebarDescription.textContent =
    "Welcome to " + restaurantName +
    ". Your digital waiter is ready to help you explore the menu.";

welcomeMessage.textContent =
    "Hello! Welcome to " + restaurantName + ".\n\n" +
    "I'm your AI waiter. You can ask me about our menu, " +
    "dishes, ingredients, prices and recommendations.\n\n" +
    "How can I help you today?";


// ==========================================
// HELPERS
// ==========================================

function setStatus(text, online = false) {

    statusText.innerHTML = "";

    const dot = document.createElement("span");

    dot.className = "status-dot";

    if (!online) {
        dot.style.background = "#d99b32";
    }

    statusText.appendChild(dot);

    statusText.appendChild(
        document.createTextNode(text)
    );
}


function showError(message) {

    connectionError.textContent = message;

    connectionError.style.display = "block";
}


function hideError() {

    connectionError.textContent = "";

    connectionError.style.display = "none";
}


function scrollToBottom() {

    chatBody.scrollTop = chatBody.scrollHeight;
}


function getCurrentTime() {

    return new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}


function getErrorMessage(data, fallback) {

    if (!data) return fallback;

    if (typeof data === "string") {
        return data;
    }

    return (
        data.detail ||
        data.message ||
        data.error ||
        data.msg ||
        fallback
    );
}


async function readResponse(response) {

    const text = await response.text();

    if (!text) return null;

    try {

        return JSON.parse(text);

    } catch {

        return text;

    }
}


// ==========================================
// ADD CHAT MESSAGE
// ==========================================

function addMessage(type, text) {

    const row = document.createElement("div");

    row.className = "message-row " + type;

    if (type === "bot") {

        const avatar = document.createElement("div");

        avatar.className = "bot-avatar";

        const icon = document.createElement("i");

        icon.className = "fa-solid fa-robot";

        avatar.appendChild(icon);

        row.appendChild(avatar);
    }

    const content = document.createElement("div");

    content.className = "message-content";

    const sender = document.createElement("div");

    sender.className = "message-sender";

    sender.textContent =
        type === "user" ? "You" : restaurantName + " AI";

    const bubble = document.createElement("div");

    bubble.className = "message-bubble";

    bubble.textContent = text;

    const time = document.createElement("div");

    time.className = "message-time";

    time.textContent = getCurrentTime();

    content.appendChild(sender);

    content.appendChild(bubble);

    content.appendChild(time);

    row.appendChild(content);

    messages.insertBefore(row, typingIndicator);

    scrollToBottom();
}


// ==========================================
// TYPING INDICATOR
// ==========================================

function showTyping() {

    typingIndicator.style.display = "flex";

    scrollToBottom();
}


function hideTyping() {

    typingIndicator.style.display = "none";
}


// ==========================================
// ENABLE / DISABLE CHAT
// ==========================================

function enableChat() {

    messageInput.disabled = false;

    sendBtn.disabled = false;

    messageInput.placeholder =
        "Ask anything about the menu...";

    footerNote.textContent =
        "Ask us anything about our menu.";
}


function disableChat() {

    messageInput.disabled = true;

    sendBtn.disabled = true;
}


// ==========================================
// INITIALIZE CHAT
// ==========================================

function initializeChat() {

    if (!restaurantId) {

        setStatus("Restaurant ID missing");

        showError(
            "Restaurant ID is missing. Please open the correct restaurant chat link."
        );

        footerNote.textContent =
            "Unable to start chat.";

        disableChat();

        return;
    }

    // ----------------------------------
    // Restore saved session
    // ----------------------------------

    try {

        sessionId = localStorage.getItem(
            SESSION_STORAGE_KEY
        );

    } catch (error) {

        console.error(
            "LocalStorage error:",
            error
        );

        sessionId = null;
    }

    // ----------------------------------
    // Enable chat immediately
    // ----------------------------------

    enableChat();

    hideError();

    setStatus("Online", true);

    messageInput.focus();
}


// ==========================================
// CHAT API REQUEST
// ==========================================

async function requestChat(question) {

    const response = await fetch(
        `${API_BASE_URL}/api/chat/${encodeURIComponent(restaurantId)}`,
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",

                ...(sessionId
                    ? {
                        "X-Chat-Session-ID": sessionId
                    }
                    : {})
            },

            body: JSON.stringify({
                question: question
            })
        }
    );

    const data = await readResponse(response);

    return {
        response,
        data
    };
}


// ==========================================
// SAVE SESSION ID
// ==========================================

function saveSessionId(newSessionId) {

    if (
        typeof newSessionId !== "string" ||
        !/^[a-f0-9]{32}$/.test(newSessionId)
    ) {

        throw new Error(
            "Invalid session ID received from server."
        );
    }

    sessionId = newSessionId;

    try {

        localStorage.setItem(
            SESSION_STORAGE_KEY,
            sessionId
        );

    } catch (error) {

        console.error(
            "Could not save session:",
            error
        );

        throw new Error(
            "Could not save chat session in this browser."
        );
    }
}


// ==========================================
// SEND MESSAGE
// ==========================================

async function sendMessage() {

    const question = messageInput.value.trim();

    if (!question || sendingMessage) {
        return;
    }

    if (!restaurantId) {

        showError(
            "Restaurant ID is missing."
        );

        return;
    }

    sendingMessage = true;

    hideError();

    addMessage("user", question);

    messageInput.value = "";

    messageInput.style.height = "auto";

    sendBtn.disabled = true;

    messageInput.disabled = true;

    showTyping();

    try {

        // ----------------------------------
        // Send message to backend
        // ----------------------------------

        const result = await requestChat(question);

        // ----------------------------------
        // Handle API errors
        // ----------------------------------

        if (!result.response.ok) {

            throw new Error(
                getErrorMessage(
                    result.data,
                    "Something went wrong."
                )
            );
        }

        // ----------------------------------
        // Validate response
        // ----------------------------------

        if (
            !result.data ||
            typeof result.data !== "object" ||
            result.data.success !== true
        ) {

            throw new Error(
                "Invalid response received from server."
            );
        }

        // ----------------------------------
        // Save session ID
        // ----------------------------------

        if (!result.data.session_id) {

            throw new Error(
                "Session ID missing from server response."
            );
        }

        saveSessionId(
            result.data.session_id
        );

        // ----------------------------------
        // Get AI answer
        // ----------------------------------

        let answer =
            result.data.answer ||
            result.data.response ||
            result.data.reply ||
            result.data.message ||
            result.data.result ||
            "";

        if (!answer) {

            answer =
                "I couldn't find a response. Please try again.";
        }

        addMessage("bot", String(answer));

        setStatus("Online", true);

        hideError();

    } catch (error) {

        console.error("Chat API error:", error);

        addMessage(
            "bot",
            "Sorry, I couldn't process your request right now. Please try again."
        );

        showError(
            error.message ||
            "Failed to send message."
        );

        setStatus("Connection failed");

    } finally {

        hideTyping();

        sendingMessage = false;

        messageInput.disabled = false;

        sendBtn.disabled = false;

        messageInput.focus();

        scrollToBottom();
    }
}


// ==========================================
// EVENT LISTENERS
// ==========================================

sendBtn.addEventListener("click", sendMessage);


messageInput.addEventListener("keydown", function (event) {

    if (
        event.key === "Enter" &&
        !event.shiftKey
    ) {

        event.preventDefault();

        sendMessage();
    }

});


messageInput.addEventListener("input", function () {

    this.style.height = "auto";

    this.style.height =
        Math.min(this.scrollHeight, 120) + "px";

});


// ==========================================
// START CHAT
// ==========================================

initializeChat();