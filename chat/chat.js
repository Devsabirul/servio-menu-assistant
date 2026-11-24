
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

let sessionReady = false;
let sessionId = null;
let sendingMessage = false;
let initializingSession = false;

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

    sessionReady = true;

    messageInput.disabled = false;

    sendBtn.disabled = false;

    messageInput.placeholder =
        "Ask anything about the menu...";

    footerNote.textContent =
        "Ask us anything about our menu.";
}


function disableChat() {

    sessionReady = false;

    messageInput.disabled = true;

    sendBtn.disabled = true;
}


// ==========================================
// INITIALIZE CHAT SESSION
// ==========================================

async function initializeSession() {

    if (initializingSession) {
        return false;
    }

    if (!restaurantId) {

        setStatus("Restaurant ID missing");

        showError(
            "Restaurant ID is missing. Please open the correct restaurant chat link."
        );

        footerNote.textContent =
            "Unable to start chat.";

        disableChat();

        return false;
    }

    initializingSession = true;

    disableChat();

    try {

        setStatus("Creating chat session...");

        footerNote.textContent =
            "Connecting to " + restaurantName + "...";

        const response = await fetch(
            `${API_BASE_URL}/api/chat/${encodeURIComponent(restaurantId)}/session`,
            {
                method: "POST",

                headers: {
                    "Accept": "application/json"
                },

                // IMPORTANT:
                // This allows the browser to receive and send cookies.
                credentials: "include"
            }
        );

        const data = await readResponse(response);

        if (!response.ok) {

            throw new Error(
                getErrorMessage(
                    data,
                    "Could not create chat session."
                )
            );
        }

        // Backend should return:
        // {
        //   success: true,
        //   restaurant_id: "...",
        //   session_id: "...",
        //   message: "Chat session is ready."
        // }

        if (
            !data ||
            typeof data !== "object" ||
            data.success !== true ||
            !data.session_id
        ) {

            throw new Error(
                "Invalid session response from server."
            );
        }

        // Keep session ID for frontend status.
        // Actual authentication/memory uses HttpOnly cookie.
        sessionId = data.session_id;

        enableChat();

        hideError();

        setStatus("Online", true);

        messageInput.focus();

        return true;

    } catch (error) {

        console.error("Session error:", error);

        disableChat();

        setStatus("Connection failed");

        showError(
            error.message ||
            "Unable to connect to the restaurant."
        );

        footerNote.textContent =
            "Could not connect. Please refresh the page to try again.";

        return false;

    } finally {

        initializingSession = false;

    }
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
                "Accept": "application/json"
            },

            // IMPORTANT:
            // Send the same session cookie with every message.
            credentials: "include",

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
// SEND MESSAGE
// ==========================================

async function sendMessage() {

    const question = messageInput.value.trim();

    if (!question || sendingMessage) {
        return;
    }

    if (!sessionReady) {

        showError(
            "Chat session is not ready. Please wait."
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

        let result = await requestChat(question);

        // ----------------------------------
        // SESSION EXPIRED OR COOKIE MISSING
        // ----------------------------------

        if (result.response.status === 401) {

            setStatus("Reconnecting...");

            footerNote.textContent =
                "Your chat session needs to be refreshed...";

            sessionReady = false;

            const newSessionReady =
                await initializeSession();

            if (!newSessionReady) {

                throw new Error(
                    "Your chat session could not be restored. Please refresh the page."
                );
            }

            // Retry the same message once.
            result = await requestChat(question);
        }

        // ----------------------------------
        // HANDLE API ERROR
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
        // GET AI ANSWER
        // ----------------------------------

        let answer = "";

        if (typeof result.data === "string") {

            answer = result.data;

        } else if (
            result.data &&
            typeof result.data === "object"
        ) {

            answer =
                result.data.answer ||
                result.data.response ||
                result.data.reply ||
                result.data.message ||
                result.data.result ||
                "";
        }

        if (!answer) {

            answer =
                "I couldn't find a response. Please try again.";
        }

        addMessage("bot", String(answer));

        setStatus("Online", true);

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

    } finally {
        hideTyping();

        sendingMessage = false;

        messageInput.disabled = !sessionReady;
        sendBtn.disabled = !sessionReady;

        if (sessionReady) {
            messageInput.focus();
        }

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

initializeSession();