import {
    auth,
    db,
    onAuthStateChanged,
    logout
} from "../assets/auth.js";

import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

import {
    API_BASE_URL
} from "../assets/firebase-config.js";


const $ = id => document.getElementById(id);


// ========================================
// GLOBAL VARIABLES
// ========================================

let user = null;
let restaurantId = null;

let menuCount = 0;
let menuLimit = 5;

let currentPlan = "standard";

let restaurantData = {};

let restaurants = [];
let menus = [];

// Complete API JSON responses
let restaurantResponses = [];


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
// HELPER FUNCTIONS
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


function getRestaurantId(response) {

    return (
        response?.restaurant?.restaurant_id ||
        response?.restaurant_id ||
        response?.restaurantId ||
        response?.id ||
        null
    );

}


function getRestaurantName(response) {

    return (
        response?.restaurant?.restaurant_name ||
        response?.restaurant_name ||
        response?.restaurantName ||
        "Restaurant"
    );

}


// ========================================
// CUSTOMER CHAT URL
// ========================================

function getRestaurantChatURL(response) {

    const id = getRestaurantId(response);

    const name = getRestaurantName(response);

    const chatURL = new URL(
        "../chat/chat.html",
        window.location.href
    );

    chatURL.searchParams.set(
        "restaurant_id",
        id
    );

    chatURL.searchParams.set(
        "restaurant_name",
        name
    );

    return chatURL.href;

}


// ========================================
// CONVERT API JSON TO RESTAURANT RECORD
// ========================================

function normalizeRestaurant(response) {

    return {

        restaurantName: getRestaurantName(response),

        restaurantId: getRestaurantId(response),

        fileName:
            response.file_name ||
            response.fileName ||
            "Restaurant menu.pdf",

        status: response.success
            ? "Processed"
            : "Failed",

        uploadedAt:
            response.uploaded_at ||
            response.uploadedAt ||
            null,

        apiResponse: response

    };

}


// ========================================
// AUTHENTICATION
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
            <div class="text-center p-4">

                <h5 class="text-danger">
                    Dashboard Load Failed
                </h5>

                <p class="text-secondary">
                    ${escapeHTML(error.message)}
                </p>

            </div>
        `;

    }

});


// ========================================
// LOAD DASHBOARD
// ========================================

async function loadDashboard() {

    const userRef = doc(db, "users", user.uid);

    const snapshot = await getDoc(userRef);

    restaurantData = snapshot.exists()
        ? snapshot.data()
        : {};


    restaurantId =
        restaurantData.restaurantId || null;


    currentPlan =
        restaurantData.plan || "standard";


    const selectedPlan =
        plans[currentPlan] || plans.standard;


    menuLimit = selectedPlan.limit;


    // Load complete API JSON responses

    restaurantResponses = Array.isArray(
        restaurantData.restaurantResponses
    )
        ? restaurantData.restaurantResponses
        : [];


    // Load existing restaurant data

    restaurants = Array.isArray(
        restaurantData.restaurants
    )
        ? restaurantData.restaurants
        : [];


    menus = Array.isArray(
        restaurantData.menus
    )
        ? restaurantData.menus
        : [];


    // Build restaurant list from JSON responses

    if (restaurantResponses.length > 0) {

        restaurants = restaurantResponses
            .map(normalizeRestaurant)
            .filter(item => item.restaurantId);

        menus = [...restaurants];

    } else if (restaurants.length === 0 && restaurantId) {

        // Legacy data support

        restaurants = [{

            restaurantName:
                restaurantData.restaurantName || "Restaurant",

            restaurantId: restaurantId,

            fileName: "Existing menu",

            status: "Processed",

            uploadedAt: null

        }];

    }


    menuCount = Math.max(
        restaurantResponses.length,
        menus.length,
        restaurants.length
    );


    // =================================
    // USER INFORMATION
    // =================================

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


    // =================================
    // RESTAURANT PROFILE
    // =================================

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

    const settings =
        restaurantData.aiSettings || {};


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

    const used =
        Math.min(menuCount, menuLimit);


    const remaining =
        Math.max(0, menuLimit - used);


    const percentage =
        menuLimit > 0
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

    const plan =
        plans[currentPlan] || plans.standard;


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

        $("overviewPrice").textContent =
            "Price not configured";


        $("billingPrice").textContent =
            "Price not configured";

    }

}


// ========================================
// UPDATE LANGUAGES
// ========================================

function updateLanguages() {

    const languages = [];


    if ($("langEnglish").checked) {
        languages.push("EN");
    }


    if ($("langItalian").checked) {
        languages.push("IT");
    }


    if ($("langBangla").checked) {
        languages.push("বাংলা");
    }


    $("languageCount").textContent =
        languages.length;


    $("languageSummary").textContent =
        languages.length
            ? languages.join(" · ")
            : "No languages selected";

}


// ========================================
// QUICK SETUP PROGRESS
// ========================================

function updateSetupProgress() {

    const profileComplete = Boolean(
        restaurantData.restaurantName &&
        restaurantData.address
    );


    const menuComplete =
        menuCount > 0;


    const qrComplete =
        restaurants.length > 0;


    const completed =
        1 +
        Number(profileComplete) +
        Number(menuComplete) +
        Number(qrComplete);


    $("setupProgress").style.width =
        (completed / 4) * 100 + "%";


    $("setupAccount").textContent =
        "✓ Account created";


    $("setupProfile").textContent =
        profileComplete
            ? "✓ Restaurant details"
            : "○ Restaurant details";


    $("profileSetupStatus").textContent =
        profileComplete ? "Done" : "Pending";


    $("setupMenu").textContent =
        menuComplete
            ? "✓ Menu uploaded"
            : "○ Menu uploaded";


    $("menuSetupStatus").textContent =
        menuComplete ? "Done" : "Pending";


    $("setupQr").textContent =
        qrComplete
            ? "✓ QR code generated"
            : "○ QR code generated";

}


// ========================================
// RENDER MENUS
// ========================================

function renderMenus(menuList = []) {

    const container =
        $("menusList");


    container.innerHTML = "";


    if (!menuList.length) {

        container.innerHTML = `
            <p class="text-secondary small">
                No restaurants uploaded yet.
            </p>
        `;

        return;

    }


    menuList.forEach((menu, index) => {

        const row =
            document.createElement("div");


        row.className = "file-row";


        const icon =
            document.createElement("i");


        icon.className =
            "bi bi-filetype-pdf text-danger fs-3";


        const info =
            document.createElement("div");


        info.className =
            "flex-grow-1";


        const title =
            document.createElement("b");


        title.className =
            "d-block";


        title.textContent =
            menu.restaurantName || "Restaurant";


        const filename =
            document.createElement("span");


        filename.className =
            "d-block";


        filename.textContent =
            menu.fileName || "Restaurant menu.pdf";


        const id =
            document.createElement("small");


        id.className =
            "d-block text-secondary";


        id.textContent =
            "ID: " + (menu.restaurantId || "N/A");


        const status =
            document.createElement("span");


        status.className =
            "badge text-bg-success";


        status.textContent =
            menu.status || "Processed";


        info.appendChild(title);

        info.appendChild(filename);

        info.appendChild(id);


        row.appendChild(icon);

        row.appendChild(info);

        row.appendChild(status);


        container.appendChild(row);

    });

}


// ========================================
// RENDER MULTIPLE RESTAURANT QR CODES
// ========================================

function renderRestaurantQRCodes() {

    const container =
        $("restaurantsQrList");


    container.innerHTML = "";


    if (!restaurantResponses.length) {

        // Legacy restaurants support

        if (!restaurants.length) {

            container.innerHTML = `
                <div class="panel text-center">

                    <i class="bi bi-qr-code display-3 text-secondary"></i>

                    <p class="text-secondary mt-3">
                        Upload a restaurant menu to generate its QR code.
                    </p>

                </div>
            `;

            return;

        }

    }


    const records = restaurantResponses.length
        ? restaurantResponses
        : restaurants;


    records.forEach((record, index) => {

        const response =
            record.apiResponse || record;


        const id =
            getRestaurantId(response) ||
            record.restaurantId;


        const name =
            getRestaurantName(response) ||
            record.restaurantName;


        if (!id) return;


        const chatURL =
            getRestaurantChatURL({

                ...response,

                restaurant: {

                    ...(response.restaurant || {}),

                    restaurant_id: id,

                    restaurant_name: name

                }

            });


        const card =
            document.createElement("div");


        card.className =
            "panel mb-3";


        card.innerHTML = `

            <div class="row align-items-center g-4">

                <div class="col-md-4 text-center">

                    <h6 class="fw-bold mb-3">
                        ${escapeHTML(name)}
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

                    <h5 class="fw-bold">
                        ${escapeHTML(name)}
                    </h5>

                    <p class="text-secondary small mb-1">
                        Restaurant ID
                    </p>

                    <code class="d-block mb-3">
                        ${escapeHTML(id)}
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
                        Processed
                    </span>


                    <details class="mt-3">

                        <summary class="small fw-semibold text-primary">
                            View API JSON response
                        </summary>

                        <pre class="bg-light p-3 mt-2 rounded small"
                            style="white-space:pre-wrap;word-break:break-word;">${escapeHTML(JSON.stringify(response, null, 2))}</pre>

                    </details>

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

    const section =
        $("view-" + view);


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

    const link =
        event.target.closest("[data-view]");


    if (!link) return;


    const view =
        link.dataset.view;


    if (!$("view-" + view)) return;


    event.preventDefault();


    showView(view);


    history.replaceState(null, "", "#" + view);

});


if (location.hash) {

    const initialView =
        location.hash.substring(1);


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

        alert(
            "Could not log out.\n" +
            error.message
        );

    }

}


$("logoutBtn").addEventListener(
    "click",
    signOutUser
);


$("logoutMenu").addEventListener(
    "click",
    signOutUser
);


// ========================================
// SAVE RESTAURANT PROFILE
// ========================================

$("restaurantForm").addEventListener("submit", async event => {

    event.preventDefault();


    const button =
        event.submitter;


    button.disabled = true;


    try {

        const profile = {

            restaurantName:
                $("restaurantName").value.trim(),

            restaurantEmail:
                $("restaurantEmail").value.trim(),

            phone:
                $("restaurantPhone").value.trim(),

            website:
                $("restaurantWebsite").value.trim(),

            address:
                $("restaurantAddress").value.trim(),

            description:
                $("restaurantDescription").value.trim(),

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


        alert(
            "Restaurant profile saved successfully."
        );

    } catch (error) {

        alert(
            "Could not save restaurant profile.\n\n" +
            error.message
        );

    } finally {

        button.disabled = false;

    }

});


// ========================================
// CHOOSE PDF
// ========================================

$("chooseMenu").addEventListener("click", () => {

    const restaurantName =
        $("uploadRestaurantName").value.trim();


    if (!restaurantName) {

        alert(
            "Please enter the restaurant name first."
        );


        $("uploadRestaurantName").focus();

        return;

    }


    $("menuFile").click();

});


// ========================================
// PDF UPLOAD
// ========================================

$("menuFile").addEventListener("change", async event => {

    const file =
        event.target.files[0];


    if (!file) return;


    const feedback =
        $("uploadFeedback");


    const button =
        $("chooseMenu");


    let apiUploadSucceeded = false;


    try {

        const restaurantName =
            $("uploadRestaurantName").value.trim();


        // VALIDATE RESTAURANT NAME

        if (!restaurantName) {

            throw new Error(
                "Please enter restaurant name."
            );

        }


        // VALIDATE PDF

        if (
            file.type !== "application/pdf" &&
            !file.name.toLowerCase().endsWith(".pdf")
        ) {

            throw new Error(
                "Please select a PDF file."
            );

        }


        // VALIDATE SIZE

        if (file.size > 15 * 1024 * 1024) {

            throw new Error(
                "Maximum PDF size is 15 MB."
            );

        }


        // VALIDATE PLAN

        if (menuCount >= menuLimit) {

            throw new Error(
                "Your package upload allowance has been reached."
            );

        }


        button.disabled = true;


        feedback.className =
            "small text-primary mt-3";


        feedback.textContent =
            "Uploading PDF and creating vector store...";


        // =================================
        // SEND PDF TO API
        // =================================

        const formData =
            new FormData();


        formData.append(
            "restaurant_name",
            restaurantName
        );


        formData.append(
            "file",
            file
        );


        const response = await fetch(
            `${API_BASE_URL}/api/restaurants/upload`,
            {
                method: "POST",
                body: formData
            }
        );


        const responseText =
            await response.text();


        let result;


        try {

            result = JSON.parse(responseText);

        } catch {

            throw new Error(
                "API returned invalid JSON:\n" + responseText
            );

        }


        // API ERROR

        if (!response.ok || !result.success) {

            throw new Error(
                result.message ||
                `API Error ${response.status}`
            );

        }


        const newRestaurantId =
            getRestaurantId(result);


        if (!newRestaurantId) {

            throw new Error(
                "API success, but restaurant_id was not found."
            );

        }


        // API SUCCESS

        apiUploadSucceeded = true;


        // =================================
        // SHOW API MESSAGE
        // =================================

        feedback.className =
            "small text-success mt-3";


        feedback.textContent =
            result.message ||
            "Restaurant menu uploaded successfully.";


        // =================================
        // SAVE COMPLETE API JSON
        // =================================

        const uploadedAt =
            new Date().toISOString();


        const completeResponse = {

            ...result,

            // Additional metadata

            file_name: file.name,

            uploaded_at: uploadedAt

        };


        // Create updated JSON list

        const updatedResponses = [

            ...restaurantResponses,

            completeResponse

        ];


        // Create restaurant list

        const updatedRestaurants =
            updatedResponses
                .map(normalizeRestaurant)
                .filter(item => item.restaurantId);


        // Create menu list

        const updatedMenus =
            [...updatedRestaurants];


        // =================================
        // SAVE TO FIREBASE
        // =================================

        const updateData = {

            // Full API JSON list

            restaurantResponses: updatedResponses,


            // Normalized list for dashboard

            restaurants: updatedRestaurants,

            menus: updatedMenus,


            // Keep profile restaurantName unchanged

            restaurantId: newRestaurantId,


            menuUploadCount: updatedResponses.length,

            updatedAt: serverTimestamp()

        };


        await setDoc(
            doc(db, "users", user.uid),
            updateData,
            { merge: true }
        );


        // =================================
        // UPDATE LOCAL DATA
        // =================================

        restaurantResponses =
            updatedResponses;


        restaurants =
            updatedRestaurants;


        menus =
            updatedMenus;


        restaurantId =
            newRestaurantId;


        restaurantData = {

            ...restaurantData,

            restaurantResponses: updatedResponses,

            restaurants: updatedRestaurants,

            menus: updatedMenus,

            restaurantId: newRestaurantId,

            menuUploadCount: updatedResponses.length

        };


        menuCount =
            updatedResponses.length;


        // =================================
        // UPDATE DASHBOARD
        // =================================

        updateUsage();

        updateSetupProgress();

        renderMenus(menus);

        renderRestaurantQRCodes();


        // =================================
        // SUCCESS MESSAGE
        // =================================

        feedback.className =
            "small text-success mt-3";


        feedback.textContent =
            result.message ||
            "Restaurant menu uploaded successfully.";


        $("uploadRestaurantName").value = "";


        alert(

            "UPLOAD SUCCESSFUL!\n\n" +

            "Message: " + result.message +

            "\nRestaurant: " + getRestaurantName(result) +

            "\nRestaurant ID: " + newRestaurantId +

            "\n\nFirebase JSON saved successfully." +

            "\nQR Code generated successfully."

        );


    } catch (error) {

        console.error(
            "UPLOAD ERROR:",
            error
        );


        feedback.className =
            "small text-danger mt-3";


        if (apiUploadSucceeded) {

            feedback.textContent =
                "Vector store created successfully, but Firebase save failed: " +
                error.message;


            alert(

                "VECTOR STORE SUCCESSFUL\n\n" +

                "But Firebase save failed.\n\n" +

                error.message

            );

        } else {

            feedback.textContent =
                error.message;


            alert(

                "UPLOAD FAILED!\n\n" +

                error.message

            );

        }

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


    const button =
        event.submitter;


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


        restaurantData.aiSettings =
            aiSettings;


        updateLanguages();


        alert(
            "AI waiter settings saved successfully."
        );

    } catch (error) {

        alert(
            "Could not save AI settings.\n\n" +
            error.message
        );

    } finally {

        button.disabled = false;

    }

});


// ========================================
// LANGUAGE COUNTER
// ========================================

[
    "langEnglish",
    "langItalian",
    "langBangla"

].forEach(id => {

    $(id).addEventListener(
        "change",
        updateLanguages
    );

});


// ========================================
// COPY AND DOWNLOAD QR
// ========================================

$("restaurantsQrList").addEventListener("click", async event => {

    // =================================
    // COPY CUSTOMER CHAT LINK
    // =================================

    const copyButton =
        event.target.closest(".copy-restaurant-link");


    if (copyButton) {

        const index =
            Number(copyButton.dataset.index);


        const response =
            restaurantResponses[index] ||
            restaurants[index];


        if (!response) return;


        const chatURL =
            getRestaurantChatURL(response);


        try {

            await navigator.clipboard.writeText(
                chatURL
            );


            copyButton.textContent =
                "Copied!";


            setTimeout(() => {

                copyButton.textContent =
                    "Copy";

            }, 1500);

        } catch {

            alert(
                "Copy failed. Please copy the URL manually."
            );

        }


        return;

    }


    // =================================
    // DOWNLOAD QR CODE
    // =================================

    const downloadButton =
        event.target.closest(".download-restaurant-qr");


    if (downloadButton) {

        const index =
            Number(downloadButton.dataset.index);


        const response =
            restaurantResponses[index] ||
            restaurants[index];


        if (!response) return;


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

            alert(
                "QR code is not ready yet."
            );

            return;

        }


        const name =
            getRestaurantName(response);


        const link =
            document.createElement("a");


        link.href =
            source;


        link.download =
            name.replace(/[^a-z0-9]/gi, "-") +
            "-QR.png";


        link.click();

    }

});
