
import { auth, db, onAuthStateChanged, logout } from "../assets/auth.js";

import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

import { API_BASE_URL } from "../assets/firebase-config.js";

const $ = id => document.getElementById(id);

let user = null;
let restaurantId = null;
let menuCount = 0;
let menuLimit = 5;
let currentPlan = "standard";
let restaurantData = {};
let restaurants = [];

const plans = {
    basic: {
        name: "Basic",
        limit: 1,
        price: null
    },
    standard: {
        name: "Standard",
        limit: 5,
        price: "€70"
    },
    premium: {
        name: "Premium",
        limit: 10,
        price: null
    }
};


// ========================================
// AUTHENTICATION AND DASHBOARD INITIALIZE
// ========================================

onAuthStateChanged(auth, async currentUser => {

    if (!currentUser) {
        location.replace("../auth/login.html");
        return;
    }

    user = currentUser;

    try {

        await loadDashboard();

        $("dashboardApp").classList.remove("d-none");
        $("authLoading").classList.add("d-none");

    } catch (error) {

        console.error("Dashboard loading error:", error);

        $("authLoading").innerHTML = `
            <p class="text-danger">
                Could not load account. Check Firestore configuration and security rules.
            </p>
        `;
    }

});


// ========================================
// LOAD DASHBOARD DATA FROM FIRESTORE
// ========================================

async function loadDashboard() {

    const userRef = doc(db, "users", user.uid);

    const snapshot = await getDoc(userRef);

    restaurantData = snapshot.exists()
        ? snapshot.data()
        : {};

    restaurantId = restaurantData.restaurantId || null;

    currentPlan = restaurantData.plan || "standard";

    const selectedPlan = plans[currentPlan] || plans.standard;

    menuLimit = selectedPlan.limit;

    const menus = Array.isArray(restaurantData.menus)
        ? restaurantData.menus
        : [];

    menuCount = menus.length;

    // Load multiple restaurants
    restaurants = Array.isArray(restaurantData.restaurants)
        ? restaurantData.restaurants
        : [];

    // Legacy data support:
    // If an old account has restaurantId but no restaurants array,
    // show its existing restaurant QR.
    if (restaurants.length === 0 && restaurantId) {

        restaurants = [{
            restaurantName: restaurantData.restaurantName || "Restaurant",
            restaurantId: restaurantId,
            fileName: menus.length
                ? menus[menus.length - 1].fileName
                : "Existing menu",
            status: "Processed",
            uploadedAt: menus.length
                ? menus[menus.length - 1].uploadedAt
                : null
        }];

    }

    const displayName =
        user.displayName ||
        restaurantData.name ||
        user.email ||
        "Restaurant owner";

    $("profileName").textContent = displayName;

    $("profileInitial").textContent =
        displayName.charAt(0).toUpperCase();

    $("welcomeName").textContent =
        displayName.split(" ")[0];

    $("restaurantName").value =
        restaurantData.restaurantName || "";

    $("restaurantEmail").value =
        restaurantData.restaurantEmail || user.email || "";

    $("restaurantPhone").value =
        restaurantData.phone || "";

    $("restaurantWebsite").value =
        restaurantData.website || "";

    $("restaurantAddress").value =
        restaurantData.address || "";

    $("restaurantDescription").value =
        restaurantData.description || "";

    loadAISettings();

    updateUsage();
    updatePlan();
    updateLanguages();
    updateSetupProgress();

    renderMenus(menus);
    renderRestaurantQRCodes();

}


// ========================================
// LOAD AI SETTINGS
// ========================================

function loadAISettings() {

    const settings = restaurantData.aiSettings || {};

    $("welcomeMessage").value =
        settings.welcomeMessage ||
        "Ciao! Welcome to our restaurant. How can I help you today?";

    $("assistantTone").value =
        settings.assistantTone ||
        "Friendly and welcoming";

    $("allergenNotice").checked =
        settings.allergenNotice !== false;

    $("langEnglish").checked =
        settings.english !== false;

    $("langItalian").checked =
        settings.italian !== false;

    $("langBangla").checked =
        settings.bangla !== false;

}


// ========================================
// UPDATE MENU USAGE
// ========================================

function updateUsage() {

    const used = Math.min(menuCount, menuLimit);

    const remaining = Math.max(0, menuLimit - used);

    const percentage = menuLimit > 0
        ? Math.min(100, (used / menuLimit) * 100)
        : 0;

    $("menuStat").textContent =
        `${used} / ${menuLimit}`;

    $("menuUsageHeader").textContent =
        `${used} / ${menuLimit} uploads used`;

    $("usageText").textContent =
        `${used} of ${menuLimit} used`;

    $("remainingText").textContent =
        `${remaining} remaining`;

    $("usageBar").style.width =
        percentage + "%";

    $("billingUsage").textContent =
        `${used} of ${menuLimit} menu uploads used`;

    $("billingBar").style.width =
        percentage + "%";

    $("planLabel").textContent =
        `${currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} package`;

}


// ========================================
// UPDATE PLAN
// ========================================

function updatePlan() {

    const plan = plans[currentPlan] || plans.standard;

    $("overviewPlan").textContent =
        plan.name.toUpperCase();

    $("billingPlanName").textContent =
        plan.name;

    $("billingDescription").textContent =
        `Up to ${plan.limit} menu uploads.`;

    if (plan.price) {

        $("overviewPrice").innerHTML =
            `${plan.price} <small class="fs-6 text-secondary">paid once</small>`;

        $("billingPrice").innerHTML =
            `${plan.price} <small class="fs-6 text-secondary">one-time payment</small>`;

    } else {

        $("overviewPrice").textContent = "Price not configured";
        $("billingPrice").textContent = "Price not configured";

    }

}


// ========================================
// UPDATE LANGUAGES
// ========================================

function updateLanguages() {

    const languages = [];

    if ($("langEnglish").checked) languages.push("EN");
    if ($("langItalian").checked) languages.push("IT");
    if ($("langBangla").checked) languages.push("বাংলা");

    $("languageCount").textContent = languages.length;

    $("languageSummary").textContent =
        languages.length ? languages.join(" · ") : "No languages selected";

}


// ========================================
// QUICK SETUP PROGRESS
// ========================================

function updateSetupProgress() {

    const profileComplete =
        Boolean(
            restaurantData.restaurantName &&
            restaurantData.address
        );

    const menuComplete = menuCount > 0;

    const qrComplete =
        restaurants.length > 0 || Boolean(restaurantId);

    const completed = 1 +
        Number(profileComplete) +
        Number(menuComplete) +
        Number(qrComplete);

    const percentage = (completed / 4) * 100;

    $("setupProgress").style.width =
        percentage + "%";

    $("setupAccount").textContent =
        "✓ Account created";

    $("setupProfile").textContent =
        profileComplete ? "✓ Restaurant details" : "○ Restaurant details";

    $("profileSetupStatus").textContent =
        profileComplete ? "Done" : "Pending";

    $("setupMenu").textContent =
        menuComplete ? "✓ Menu uploaded" : "○ Menu uploaded";

    $("menuSetupStatus").textContent =
        menuComplete ? "Done" : "Pending";

    $("setupQr").textContent =
        qrComplete ? "✓ QR code generated" : "○ QR code generated";

}


// ========================================
// RENDER MENU LIST
// ========================================

function renderMenus(menus = []) {

    const container = $("menusList");

    container.innerHTML = "";

    if (!menus.length) {

        container.innerHTML = `
            <p class="text-secondary small mb-0">
                No menus uploaded yet.
            </p>
        `;

        return;
    }

    menus.forEach(menu => {

        const row = document.createElement("div");

        row.className = "file-row";

        const icon = document.createElement("i");

        icon.className =
            "bi bi-filetype-pdf text-danger fs-3";

        const info = document.createElement("div");

        info.className = "flex-grow-1";

        const restaurantTitle = document.createElement("b");

        restaurantTitle.className = "d-block";

        restaurantTitle.textContent =
            menu.restaurantName || "Restaurant";

        const title = document.createElement("span");

        title.className = "d-block";

        title.textContent =
            menu.fileName || "Restaurant menu.pdf";

        const date = document.createElement("small");

        if (menu.uploadedAt) {

            const uploadDate = new Date(menu.uploadedAt);

            date.textContent =
                "Uploaded " + uploadDate.toLocaleString();

        } else {

            date.textContent = "Recently uploaded";

        }

        const status = document.createElement("span");

        status.className = "badge text-bg-success";

        status.textContent =
            menu.status || "Processed";

        info.appendChild(restaurantTitle);
        info.appendChild(title);
        info.appendChild(date);

        row.appendChild(icon);
        row.appendChild(info);
        row.appendChild(status);

        container.appendChild(row);

    });

}


// ========================================
// GENERATE CHAT URL
// ========================================

function getRestaurantChatURL(restaurant) {

    const chatURL = new URL(
        "../chat/chat.html",
        window.location.href
    );

    chatURL.searchParams.set(
        "restaurant_id",
        restaurant.restaurantId
    );

    chatURL.searchParams.set(
        "restaurant_name",
        restaurant.restaurantName || "Restaurant"
    );

    return chatURL.href;

}


// ========================================
// ESCAPE HTML
// ========================================

function escapeHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, char => ({

        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"

    })[char]);

}


// ========================================
// RENDER MULTIPLE RESTAURANT QR CODES
// ========================================

function renderRestaurantQRCodes() {

    const container = $("restaurantsQrList");

    container.innerHTML = "";

    if (!restaurants.length) {

        container.innerHTML = `
            <div class="panel text-center">

                <i class="bi bi-qr-code display-3 text-secondary"></i>

                <p class="text-secondary mt-3 mb-0">
                    Upload a restaurant menu to generate its QR code.
                </p>

            </div>
        `;

        return;
    }

    restaurants.forEach((restaurant, index) => {

        if (!restaurant.restaurantId) return;

        const restaurantName =
            restaurant.restaurantName || "Restaurant";

        const chatURL =
            getRestaurantChatURL(restaurant);

        const safeName =
            escapeHTML(restaurantName);

        const safeId =
            escapeHTML(restaurant.restaurantId);

        const card = document.createElement("div");

        card.className = "panel mb-3";

        card.innerHTML = `

            <div class="row align-items-center g-4">

                <div class="col-md-4 text-center">

                    <h6 class="fw-bold mb-3">
                        ${safeName}
                    </h6>

                    <div
                        id="restaurant-qr-${index}"
                        class="qr-box d-inline-flex justify-content-center align-items-center"
                    ></div>

                    <div class="mt-3">

                        <button
                            class="btn btn-primary btn-sm rounded-pill download-restaurant-qr"
                            data-index="${index}"
                            type="button"
                        >
                            <i class="bi bi-download me-1"></i>
                            Download QR
                        </button>

                    </div>

                </div>

                <div class="col-md-8">

                    <h5 class="fw-bold mb-2">
                        ${safeName}
                    </h5>

                    <p class="text-secondary small mb-2">
                        Restaurant ID
                    </p>

                    <code class="small d-block mb-3">
                        ${safeId}
                    </code>

                    <label class="form-label small fw-semibold">
                        Customer Chat URL
                    </label>

                    <div class="input-group mb-3">

                        <input
                            type="text"
                            class="form-control"
                            value="${escapeHTML(chatURL)}"
                            readonly
                        >

                        <button
                            class="btn btn-outline-primary copy-restaurant-link"
                            data-index="${index}"
                            type="button"
                        >
                            Copy
                        </button>

                    </div>

                    <a
                        href="${escapeHTML(chatURL)}"
                        target="_blank"
                        rel="noopener"
                        class="btn btn-outline-dark btn-sm rounded-pill"
                    >
                        <i class="bi bi-box-arrow-up-right me-1"></i>
                        Preview customer chat
                    </a>

                    <span class="badge text-bg-success ms-2">
                        ${escapeHTML(restaurant.status || "Processed")}
                    </span>

                </div>

            </div>

        `;

        container.appendChild(card);

        const qrContainer =
            card.querySelector(`#restaurant-qr-${index}`);

        if (window.QRCode) {

            new QRCode(qrContainer, {

                text: chatURL,

                width: 190,

                height: 190,

                correctLevel: QRCode.CorrectLevel.H

            });

        } else {

            qrContainer.innerHTML = `
                <p class="text-danger small">
                    QR Code library not loaded.
                </p>
            `;

        }

    });

}


// ========================================
// NAVIGATION
// ========================================

function showView(view) {

    const section = $("view-" + view);

    if (!section) return;

    document.querySelectorAll(".view-section").forEach(item => {
        item.classList.add("d-none");
    });

    section.classList.remove("d-none");

    document.querySelectorAll(".side-link[data-view]").forEach(link => {

        link.classList.toggle(
            "active",
            link.dataset.view === view
        );

    });

    const labels = {

        overview: "Overview",
        restaurant: "Restaurant profile",
        menus: "Menu manager",
        qr: "Restaurant QR codes",
        conversations: "Conversations",
        settings: "AI waiter settings",
        billing: "Plan & payments"

    };

    $("pageTitle").textContent =
        labels[view] || "Overview";

    $("sidebar").classList.remove("open");

}

document.addEventListener("click", event => {

    const link = event.target.closest("[data-view]");

    if (!link) return;

    const view = link.dataset.view;

    if (!$("view-" + view)) return;

    event.preventDefault();

    showView(view);

    history.replaceState(null, "", "#" + view);

});

if (location.hash) {

    const initialView = location.hash.substring(1);

    if ($("view-" + initialView)) {
        showView(initialView);
    }

}

$("menuToggle").addEventListener("click", () => {

    $("sidebar").classList.toggle("open");

});


// ========================================
// LOGOUT
// ========================================

async function signOutUser() {

    try {

        await logout();

        location.replace("../auth/login.html");

    } catch (error) {

        console.error("Logout error:", error);

        alert("Could not log out. Try again.");

    }

}

$("logoutBtn").addEventListener("click", signOutUser);

$("logoutMenu").addEventListener("click", signOutUser);


// ========================================
// SAVE RESTAURANT PROFILE
// ========================================

$("restaurantForm").addEventListener("submit", async event => {

    event.preventDefault();

    const button = event.submitter;

    button.disabled = true;

    try {

        const profile = {

            restaurantName: $("restaurantName").value.trim(),

            restaurantEmail: $("restaurantEmail").value.trim(),

            phone: $("restaurantPhone").value.trim(),

            website: $("restaurantWebsite").value.trim(),

            address: $("restaurantAddress").value.trim(),

            description: $("restaurantDescription").value.trim(),

            updatedAt: serverTimestamp()

        };

        await setDoc(
            doc(db, "users", user.uid),
            profile,
            { merge: true }
        );

        restaurantData = {
            ...restaurantData,
            ...profile
        };

        updateSetupProgress();

        alert("Restaurant profile saved successfully.");

    } catch (error) {

        console.error("Profile save error:", error);

        alert("Could not save restaurant profile. Check Firestore rules.");

    } finally {

        button.disabled = false;

    }

});


// ========================================
// PDF UPLOAD
// FASTAPI: POST /api/restaurants/upload
// ========================================

$("chooseMenu").addEventListener("click", () => {

    $("menuFile").click();

});


$("menuFile").addEventListener("change", async event => {

    const file = event.target.files[0];

    if (!file) return;

    const feedback = $("uploadFeedback");

    const button = $("chooseMenu");

    try {

        // Restaurant name is entered separately for every upload.
        const restaurantName =
            $("uploadRestaurantName").value.trim();

        if (!restaurantName) {

            throw new Error("Please enter the restaurant name.");

        }

        if (file.type !== "application/pdf") {

            throw new Error("Please select a PDF file.");

        }

        if (file.size > 15 * 1024 * 1024) {

            throw new Error("Maximum file size is 15 MB.");

        }

        if (menuCount >= menuLimit) {

            throw new Error("Your package upload allowance has been reached.");

        }

        button.disabled = true;

        feedback.className =
            "small text-primary mt-3";

        feedback.textContent =
            "Uploading PDF and creating vectors. Please wait...";

        const formData = new FormData();

        formData.append("restaurant_name", restaurantName);

        formData.append("file", file);
        let response;

try {
    alert("Uploading PDF...\nAPI: " + API_BASE_URL);

    response = await fetch(
        `${API_BASE_URL}/api/restaurants/upload`,
        {
            method: "POST",
            body: formData
        }
    );

} catch (error) {
    alert(
        "FETCH ERROR!\n\n" +
        "Name: " + error.name +
        "\nMessage: " + error.message
    );
    throw error;
}

alert("HTTP STATUS: " + response.status);

const responseText = await response.text();

alert("API RESPONSE:\n" + responseText);

if (!response.ok) {
    throw new Error(responseText || "Upload failed");
}

let data;

try {
    data = JSON.parse(responseText);
} catch {
    alert("API response is not valid JSON!");
    throw new Error("Invalid JSON response");
}

        const responseText = await response.text();

        if (!response.ok) {

            throw new Error(
                `API Error ${response.status}: ${responseText}`
            );

        }

        let result;

        try {

            result = JSON.parse(responseText);

        } catch {

            throw new Error("Backend returned an invalid JSON response.");

        }

        const newRestaurantId =
            result?.restaurant?.restaurant_id ||
            result?.restaurant_id ||
            result?.restaurantId ||
            result?.id ||
            null;

        if (!result?.success || !newRestaurantId) {

            throw new Error(
                result?.message || "Restaurant ID not found."
            );

        }

        // New restaurant record
        const restaurantRecord = {

            restaurantName: restaurantName,

            restaurantId: newRestaurantId,

            fileName: file.name,

            status: "Processed",

            uploadedAt: new Date().toISOString()

        };

        // Save all restaurants
        const updatedRestaurants = [

            ...restaurants,

            restaurantRecord

        ];

        // Save all uploaded menus
        const updatedMenus = [

            ...(Array.isArray(restaurantData.menus)
                ? restaurantData.menus
                : []),

            restaurantRecord

        ];

        const updateData = {

            restaurants: updatedRestaurants,

            menus: updatedMenus,

            // Keep latest ID for compatibility with existing data
            restaurantId: newRestaurantId,

            menuUploadCount: updatedMenus.length,

            updatedAt: serverTimestamp()

        };

        await setDoc(
            doc(db, "users", user.uid),
            updateData,
            { merge: true }
        );

        // Update local state
        restaurants = updatedRestaurants;

        restaurantId = newRestaurantId;

        restaurantData = {

            ...restaurantData,

            ...updateData

        };

        menuCount = updatedMenus.length;

        // Update dashboard
        updateUsage();

        updateSetupProgress();

        renderMenus(updatedMenus);

        renderRestaurantQRCodes();

        // Clear upload name after success
        $("uploadRestaurantName").value = "";

        feedback.className =
            "small text-success mt-3";

        feedback.textContent =
            result.message || "Restaurant menu uploaded successfully.";

    } catch (error) {

        console.error("PDF upload error:", error);

        feedback.className =
            "small text-danger mt-3";

        feedback.textContent =
            error.message;

    } finally {

        button.disabled = false;

        event.target.value = "";

    }

});


// ========================================
// SAVE AI WAITER SETTINGS
// ========================================

$("settingsForm").addEventListener("submit", async event => {

    event.preventDefault();

    const button = event.submitter;

    button.disabled = true;

    try {

        const aiSettings = {

            welcomeMessage:
                $("welcomeMessage").value.trim(),

            english:
                $("langEnglish").checked,

            italian:
                $("langItalian").checked,

            bangla:
                $("langBangla").checked,

            assistantTone:
                $("assistantTone").value,

            allergenNotice:
                $("allergenNotice").checked

        };

        await setDoc(
            doc(db, "users", user.uid),
            {
                aiSettings: aiSettings,
                updatedAt: serverTimestamp()
            },
            { merge: true }
        );

        restaurantData.aiSettings = aiSettings;

        updateLanguages();

        alert("AI waiter settings saved successfully.");

    } catch (error) {

        console.error("Settings save error:", error);

        alert("Could not save AI settings. Check Firestore rules.");

    } finally {

        button.disabled = false;

    }

});


// ========================================
// UPDATE LANGUAGE COUNTER
// ========================================

["langEnglish", "langItalian", "langBangla"].forEach(id => {

    $(id).addEventListener("change", updateLanguages);

});


// ========================================
// COPY AND DOWNLOAD RESTAURANT QR CODES
// ========================================

$("restaurantsQrList").addEventListener("click", async event => {

    // COPY CHAT URL
    const copyButton =
        event.target.closest(".copy-restaurant-link");

    if (copyButton) {

        const index = Number(copyButton.dataset.index);

        const restaurant = restaurants[index];

        if (!restaurant) return;

        const chatURL =
            getRestaurantChatURL(restaurant);

        try {

            await navigator.clipboard.writeText(chatURL);

            copyButton.textContent = "Copied!";

            setTimeout(() => {

                copyButton.textContent = "Copy";

            }, 1500);

        } catch (error) {

            console.error("Copy error:", error);

            alert("Copy failed. Please copy the URL manually.");

        }

        return;

    }


    // DOWNLOAD QR CODE
    const downloadButton =
        event.target.closest(".download-restaurant-qr");

    if (downloadButton) {

        const index = Number(downloadButton.dataset.index);

        const restaurant = restaurants[index];

        if (!restaurant) return;

        const qrContainer =
            $(`restaurant-qr-${index}`);

        if (!qrContainer) return;

        const image =
            qrContainer.querySelector("img");

        const canvas =
            qrContainer.querySelector("canvas");

        const source =
            image?.src ||
            canvas?.toDataURL("image/png");

        if (!source) {

            alert("QR code is not ready yet.");

            return;

        }

        const link = document.createElement("a");

        link.href = source;

        link.download =
            `${(restaurant.restaurantName || "restaurant")
                .replace(/[^a-z0-9]/gi, "-")}-QR.png`;

        link.click();

    }

});
