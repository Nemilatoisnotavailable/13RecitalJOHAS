const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyt-JUocBX3tT5lkw0kKnr1ZjMCbk_4rINbk_VVNAHuiYLRfAQGmS6uTinlIy2LpKNg/exec";
const DEMO_POEM = {
    id: "A1",
    nome: "Poema 1",
    declamador: "Nome do Declamador",
    autor: "Nome do Autor",
    texto: "O vento sorriu,\nna testa mora o brilho.\nPente aposentou.",
    turma: "5º Ano A"
};

const CLASSIFICATION_LABELS = {
    A: "4ºs e 5ºs Anos",
    B: "6ºs e 7ºs Anos",
    C: "8ºs e 9ºs Anos"
};

const CRITERION_LABELS = {
    declamacao: "Declamação",
    poema: "Poema",
    total: "Total"
};

const state = {
    usuario: "",
    juradoId: "",
    login: "",
    token: "",
    poema: null,
    submittedNote: "",
    pendingReplacementNote: "",
    isEditingSubmittedNote: false,
    classificationData: null,
    selectedCategory: "A",
    selectedCriterion: "declamacao",
    currentPoemCategory: "",
    currentPoemId: "",
    currentPoemGroups: [],
    currentPoemPickerTouched: false,
    pendingCurrentPoemConfirmation: null,
    pendingNoteConfirmation: null,
    currentScreen: "login"
};

const loginScreen = document.querySelector("#loginScreen");
const evaluationScreen = document.querySelector("#evaluationScreen");
const adminScreen = document.querySelector("#adminScreen");
const classificationScreen = document.querySelector("#classificationScreen");

const loginForm = document.querySelector("#loginForm");
const evaluationForm = document.querySelector("#evaluationForm");
const logoutButton = document.querySelector("#logoutButton");
const adminLogoutButton = document.querySelector("#adminLogoutButton");
const classificationLogoutButton = document.querySelector("#classificationLogoutButton");
const adminRefreshButton = document.querySelector("#adminRefreshButton");
const openClassificationButton = document.querySelector("#openClassificationButton");
const backToAdminButton = document.querySelector("#backToAdminButton");

const loginMessage = document.querySelector("#loginMessage");
const evaluationMessage = document.querySelector("#evaluationMessage");
const poemMessage = document.querySelector("#poemMessage");
const adminMessage = document.querySelector("#adminMessage");
const classificationMessage = document.querySelector("#classificationMessage");

const poemTitle = document.querySelector("#evaluationTitle");
const poemAuthor = document.querySelector("#poemAuthor");
const poemDeclamador = document.querySelector("#poemDeclamador");
const poemText = document.querySelector("#poemText");
const poemCredits = document.querySelector(".poem-credits");
const adminTitle = document.querySelector("#adminTitle");
const adminPoemAuthor = document.querySelector("#adminPoemAuthor");
const adminPoemDeclamador = document.querySelector("#adminPoemDeclamador");
const adminCredits = document.querySelector(".admin-credits");
const adminJurorList = document.querySelector("#adminJurorList");
const mediaDeclamacao = document.querySelector("#mediaDeclamacao");
const mediaPoema = document.querySelector("#mediaPoema");
const mediaGeral = document.querySelector("#mediaGeral");
const classificationRanking = document.querySelector("#classificationRanking");
const currentPoemSelect = document.querySelector("#currentPoemSelect");

const loginCredentials = Array.from(document.querySelectorAll("#loginCredentials [data-login][data-senha]"));
const senhaInput = document.querySelector("#senha");
const notaInput = document.querySelector("#nota");
const gradeBlock = document.querySelector("#gradeBlock");
const editNoteButton = document.querySelector("#editNoteButton");
const waitingPanel = document.querySelector("#waitingPanel");
const sendButton = evaluationForm.querySelector(".send-button");
const categoryButtons = Array.from(document.querySelectorAll("[data-category]"));
const criterionButtons = Array.from(document.querySelectorAll("[data-criterion]"));
const currentPoemCategoryButtons = Array.from(document.querySelectorAll("[data-current-category]"));

const POEM_FONT_MAX = 1.65;
const POEM_FONT_MIN = 0.72;
const POEM_FONT_FALLBACK_MIN = 0.56;
const POEM_FONT_STEP = 0.04;
const AUTO_REFRESH_MS = 5000;
const SESSION_STORAGE_KEY = "recitalJohasSession";
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

let autoRefreshTimer = null;
let poemRefreshInProgress = false;
let adminRefreshInProgress = false;
let classificationRefreshInProgress = false;

function normalizeLogin(value) {
    return value.trim().toLowerCase();
}

function findCredential(usuario, senha) {
    const normalizedUser = normalizeLogin(usuario);

    return loginCredentials.find((credential) => {
        return normalizeLogin(credential.dataset.login || "") === normalizedUser
            && (credential.dataset.senha || "") === senha;
    });
}

function authenticateFromHtml(usuario, senha) {
    const credential = findCredential(usuario, senha);

    if (!credential) {
        throw new Error("Login ou senha incorretos.");
    }

    return {
        ok: true,
        juradoId: credential.dataset.juradoId || "1",
        nome: credential.dataset.nome || usuario,
        login: credential.dataset.login || usuario,
        token: ""
    };
}

function buildScriptUrl(params = {}) {
    const url = new URL(APPS_SCRIPT_URL);

    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
    });

    url.searchParams.set("_ts", String(Date.now()));

    return url.toString();
}

async function authenticateUser(usuario, senha) {
    if (APPS_SCRIPT_URL) {
        try {
            const response = await fetch(buildScriptUrl({
                acao: "login",
                login: usuario,
                senha
            }), {
                method: "GET",
                cache: "no-store"
            });

            if (!response.ok) {
                throw new Error("Não foi possível validar o login.");
            }

            const data = await response.json();

            if (data.ok) {
                return data;
            }

            if (Object.prototype.hasOwnProperty.call(data, "ok") || data.erro) {
                throw new Error(`AUTH:${data.erro || "Login ou senha incorretos."}`);
            }
        } catch (error) {
            if (error.message.startsWith("AUTH:")) {
                throw new Error(error.message.replace("AUTH:", ""));
            }
        }
    }

    return authenticateFromHtml(usuario, senha);
}

function setScreen(screenName) {
    const isEvaluation = screenName === "evaluation";
    const isAdmin = screenName === "admin";
    const isClassification = screenName === "classification";
    const isLogin = !isEvaluation && !isAdmin && !isClassification;

    state.currentScreen = isLogin ? "login" : screenName;

    loginScreen.classList.toggle("is-active", isLogin);
    evaluationScreen.classList.toggle("is-active", isEvaluation);
    adminScreen.classList.toggle("is-active", isAdmin);
    classificationScreen.classList.toggle("is-active", isClassification);
    document.body.classList.toggle("evaluation-open", isEvaluation);
    document.body.classList.toggle("admin-open", isAdmin);
    document.body.classList.toggle("classification-open", isClassification);

    if (isLogin) {
        stopAutoRefresh();
    } else {
        saveSession();
        saveSessionEverywhere();
        startAutoRefresh();
    }
}

function saveSession() {
    if (!state.juradoId) {
        return;
    }

    try {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
            usuario: state.usuario,
            juradoId: state.juradoId,
            login: state.login,
            token: state.token,
            currentScreen: state.currentScreen,
            selectedCategory: state.selectedCategory,
            selectedCriterion: state.selectedCriterion,
            expiresAt: Date.now() + SESSION_DURATION_MS
        }));
    } catch (error) {
        console.warn("Não foi possível salvar a sessão local.", error);
    }
}

function readSavedSession() {
    try {
        const rawSession = localStorage.getItem(SESSION_STORAGE_KEY);

        if (!rawSession) {
            return null;
        }

        const savedSession = JSON.parse(rawSession);

        if (!savedSession?.juradoId || Date.now() > Number(savedSession.expiresAt || 0)) {
            clearSavedSession();
            return null;
        }

        return savedSession;
    } catch (error) {
        clearSavedSession();
        return null;
    }
}

function clearSavedSession() {
    try {
        localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
        console.warn("Não foi possível limpar a sessão local.", error);
    }
}

function saveSessionEverywhere() {
    if (!state.juradoId) {
        return;
    }

    const sessionPayload = JSON.stringify({
        usuario: state.usuario,
        juradoId: state.juradoId,
        login: state.login,
        token: state.token,
        currentScreen: state.currentScreen,
        selectedCategory: state.selectedCategory,
        selectedCriterion: state.selectedCriterion,
        expiresAt: Date.now() + SESSION_DURATION_MS
    });

    try {
        localStorage.setItem(SESSION_STORAGE_KEY, sessionPayload);
    } catch (error) {
        console.warn("Nao foi possivel salvar a sessao local.", error);
    }

    try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, sessionPayload);
    } catch (error) {
        console.warn("Nao foi possivel salvar a sessao da aba.", error);
    }
}

function readSavedSessionEverywhere() {
    let rawSession = "";

    try {
        rawSession = localStorage.getItem(SESSION_STORAGE_KEY) || "";
    } catch (error) {
        console.warn("Nao foi possivel ler a sessao local.", error);
    }

    if (!rawSession) {
        try {
            rawSession = sessionStorage.getItem(SESSION_STORAGE_KEY) || "";
        } catch (error) {
            console.warn("Nao foi possivel ler a sessao da aba.", error);
        }
    }

    if (!rawSession) {
        return null;
    }

    try {
        const savedSession = JSON.parse(rawSession);

        if (!savedSession?.juradoId || Date.now() > Number(savedSession.expiresAt || 0)) {
            clearSavedSessionEverywhere();
            return null;
        }

        return savedSession;
    } catch (error) {
        clearSavedSessionEverywhere();
        return null;
    }
}

function clearSavedSessionEverywhere() {
    clearSavedSession();

    try {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
        console.warn("Nao foi possivel limpar a sessao da aba.", error);
    }
}

function setMessage(element, message = "", type = "error") {
    element.textContent = message;
    element.classList.toggle("success", type === "success");
}

function setWaitingForJurors(isWaiting) {
    gradeBlock.hidden = isWaiting;
    waitingPanel.hidden = !isWaiting;
    notaInput.disabled = isWaiting;

    if (isWaiting) {
        editNoteButton.hidden = true;
    }
}

function lockSubmittedNote(note) {
    const noteText = String(note || "").trim();

    state.submittedNote = noteText;
    state.pendingReplacementNote = "";
    state.isEditingSubmittedNote = false;
    gradeBlock.classList.add("is-submitted");
    gradeBlock.classList.remove("is-editing");
    notaInput.readOnly = true;
    notaInput.disabled = false;
    notaInput.value = noteText;
    notaInput.placeholder = "NOTA";
    editNoteButton.hidden = false;
    setWaitingForJurors(false);
    setMessage(evaluationMessage, `Enviada a nota ${noteText}`, "success");
}

function unlockSubmittedNoteForEditing() {
    if (!state.submittedNote) {
        return;
    }

    state.isEditingSubmittedNote = true;
    state.pendingReplacementNote = "";
    gradeBlock.classList.remove("is-submitted");
    gradeBlock.classList.add("is-editing");
    notaInput.readOnly = false;
    notaInput.disabled = false;
    notaInput.value = "";
    notaInput.placeholder = "NOTA";
    editNoteButton.hidden = true;
    setWaitingForJurors(false);
    setMessage(
        evaluationMessage,
        `Enviada a nota ${state.submittedNote}. Digite a nova nota.`,
        "success"
    );
    notaInput.focus();
}

function resetNoteEntry({ clearValue = true } = {}) {
    state.submittedNote = "";
    state.pendingReplacementNote = "";
    state.isEditingSubmittedNote = false;
    gradeBlock.classList.remove("is-submitted", "is-editing");
    notaInput.readOnly = false;
    notaInput.disabled = false;
    notaInput.placeholder = "NOTA";
    editNoteButton.hidden = true;

    if (clearValue) {
        notaInput.value = "";
    }
}

function restoreNoteAfterSendFailure(attemptedNote, previousSubmittedNote) {
    resetNoteEntry({ clearValue: false });
    notaInput.value = String(attemptedNote || "").trim();

    if (previousSubmittedNote) {
        state.submittedNote = previousSubmittedNote;
        state.isEditingSubmittedNote = true;
        gradeBlock.classList.add("is-editing");
    }
}

function formatGrade(value, options = {}) {
    if (value === "" || value === null || typeof value === "undefined") {
        return options.placeholder || "--------";
    }

    const numericValue = Number(String(value).replace(",", "."));

    if (!Number.isFinite(numericValue)) {
        return options.placeholder || "--------";
    }

    const minimumFractionDigits = Number.isInteger(numericValue) && !options.forceDecimal ? 0 : 1;

    return new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits,
        maximumFractionDigits: 2
    }).format(numericValue);
}

function fitElementFont(element, cssVariable, max, min, step) {
    element.style.setProperty(cssVariable, `${max}rem`);

    requestAnimationFrame(() => {
        let size = max;

        while (
            size > min
            && (
                element.scrollWidth > element.clientWidth + 1
                || element.scrollHeight > element.clientHeight + 1
            )
        ) {
            size -= step;
            element.style.setProperty(cssVariable, `${size.toFixed(2)}rem`);
        }
    });
}

function fitPoemHeader() {
    fitElementFont(poemTitle, "--title-font-size", 4.35, 2.05, 0.08);
    fitElementFont(poemCredits, "--credit-font-size", 1.75, 1.02, 0.04);
}

function fitAdminHeader() {
    fitElementFont(adminTitle, "--admin-title-font-size", 4.35, 2.05, 0.08);
    fitElementFont(adminCredits, "--admin-credit-font-size", 1.7, 0.98, 0.04);
}

function getPoemColumnCount(text) {
    const normalizedText = String(text || "").trim();
    const characterCount = normalizedText.replace(/\s/g, "").length;
    const lineCount = normalizedText ? normalizedText.split(/\r?\n/).length : 0;

    if (characterCount > 900 || lineCount > 44) {
        return 3;
    }

    if (characterCount > 330 || lineCount > 20) {
        return 2;
    }

    return 1;
}

function poemTextOverflows() {
    return (
        poemText.scrollWidth > poemText.clientWidth + 1
        || poemText.scrollHeight > poemText.clientHeight + 1
    );
}

function fitPoemText() {
    const text = state.poema?.texto || poemText.textContent || "";
    let columns = getPoemColumnCount(text);
    let size = POEM_FONT_MAX;

    poemText.style.setProperty("--poem-columns", columns);
    poemText.style.setProperty("--poem-font-size", `${POEM_FONT_MAX}rem`);

    requestAnimationFrame(() => {
        while (true) {
            while (size > POEM_FONT_MIN && poemTextOverflows()) {
                size -= POEM_FONT_STEP;
                poemText.style.setProperty("--poem-font-size", `${size.toFixed(2)}rem`);
            }

            if (columns < 3 && (poemTextOverflows() || size < 1.02)) {
                columns += 1;
                size = POEM_FONT_MAX;
                poemText.style.setProperty("--poem-columns", columns);
                poemText.style.setProperty("--poem-font-size", `${size}rem`);
                continue;
            }

            break;
        }

        while (size > POEM_FONT_FALLBACK_MIN && poemTextOverflows()) {
            size -= POEM_FONT_STEP;
            poemText.style.setProperty("--poem-font-size", `${size.toFixed(2)}rem`);
        }
    });
}

function renderPoemText(text) {
    const normalizedText = String(text || "")
        .replace(/\r\n?/g, "\n")
        .trim();

    if (!normalizedText) {
        poemText.replaceChildren();
        return;
    }

    const stanzas = normalizedText.split(/\n\s*\n+/).map((stanza) => {
        const paragraph = document.createElement("p");
        paragraph.textContent = stanza.trim();
        return paragraph;
    });

    poemText.replaceChildren(...stanzas);
}

function renderPoem(poem) {
    state.poema = poem;
    const poemLabel = poem.nome || poem.titulo || (poem.id ? `Poema ${poem.id}` : "Nome do Poema");

    poemTitle.textContent = poemLabel;
    poemAuthor.textContent = poem.autor || "Nome do Autor";
    poemDeclamador.textContent = poem.declamador || poem.titulo || "Nome do Declamador";
    renderPoemText(poem.texto);
    fitPoemHeader();
    fitPoemText();
}

function getCategoryIdFromPoemId(poemId) {
    return String(poemId || "").trim().charAt(0).toUpperCase();
}

function getCurrentPoemLabel(poem = {}) {
    const id = String(poem.id || "").trim();
    const name = String(poem.nome || poem.titulo || (id ? `Poema ${id}` : "")).trim();
    const author = String(poem.autor || "").trim();
    const declamador = String(poem.declamador || "").trim();

    return [id, name, author, declamador].filter(Boolean).join(" / ");
}

function setCurrentPoemPickerDisabled(isDisabled) {
    currentPoemCategoryButtons.forEach((button) => {
        button.disabled = isDisabled;
    });

    currentPoemSelect.disabled = isDisabled || currentPoemSelect.options.length <= 1;
}

function renderCurrentPoemControl(data = {}) {
    const control = data.controle || {};
    const groups = Array.isArray(control.categorias) ? control.categorias : state.currentPoemGroups;
    const confirmedId = String(control.poemaAtualId || data.poema?.id || "").trim();
    const pendingConfirmation = state.pendingCurrentPoemConfirmation;
    const pendingIsConfirmed = pendingConfirmation?.poemId === confirmedId;
    const pendingHasExpired = pendingConfirmation && Date.now() >= pendingConfirmation.expiresAt;
    const currentId = pendingConfirmation && !pendingIsConfirmed && !pendingHasExpired
        ? pendingConfirmation.poemId
        : confirmedId;
    const currentCategory = getCategoryIdFromPoemId(currentId);

    if (pendingIsConfirmed || pendingHasExpired) {
        state.pendingCurrentPoemConfirmation = null;
    }

    state.currentPoemGroups = groups;
    state.currentPoemId = currentId;

    if (!state.currentPoemCategory || !state.currentPoemPickerTouched) {
        state.currentPoemCategory = currentCategory || state.currentPoemCategory || "A";
    }

    const selectedCategory = state.currentPoemCategory || "A";
    const selectedGroup = groups.find((group) => group.id === selectedCategory);
    const poems = Array.isArray(selectedGroup?.poemas) ? selectedGroup.poemas : [];
    const currentIdBelongsToCategory = getCategoryIdFromPoemId(currentId) === selectedCategory;
    const hasCurrentOption = poems.some((poem) => String(poem.id) === currentId);
    const placeholder = document.createElement("option");

    placeholder.value = "";
    placeholder.textContent = poems.length
        ? "ID / Nome do Poema / Autor / Declamador"
        : "Nenhum poema encontrado nesta categoria";
    placeholder.disabled = true;

    currentPoemSelect.replaceChildren(
        placeholder,
        ...poems.map((poem) => {
            const option = document.createElement("option");
            option.value = poem.id;
            option.textContent = getCurrentPoemLabel(poem);
            return option;
        })
    );

    currentPoemSelect.value = currentIdBelongsToCategory && hasCurrentOption ? currentId : "";
    currentPoemSelect.disabled = poems.length === 0;

    currentPoemCategoryButtons.forEach((button) => {
        const isSelected = button.dataset.currentCategory === selectedCategory;
        button.classList.toggle("is-selected", isSelected);
    });
}

function applyEvaluationState(poem, { poemChanged = false } = {}) {
    const evaluation = poem?.avaliacao || {};
    const sentNote = evaluation.enviada ? String(evaluation.nota || "").trim() : "";
    const poemId = String(poem?.id || "").trim();
    const pendingConfirmation = state.pendingNoteConfirmation;
    const pendingMatchesPoem = pendingConfirmation?.poemId === poemId;
    const pendingIsConfirmed = pendingMatchesPoem && sentNote === pendingConfirmation.note;
    const pendingHasExpired = pendingMatchesPoem && Date.now() >= pendingConfirmation.expiresAt;

    if (pendingConfirmation && !pendingMatchesPoem && poemChanged) {
        state.pendingNoteConfirmation = null;
    }

    if (pendingMatchesPoem && !pendingIsConfirmed && !pendingHasExpired) {
        lockSubmittedNote(pendingConfirmation.note);
        return;
    }

    if (pendingMatchesPoem && (pendingIsConfirmed || pendingHasExpired)) {
        state.pendingNoteConfirmation = null;
    }

    const keepEditing = Boolean(
        sentNote
        && !poemChanged
        && state.isEditingSubmittedNote
        && document.activeElement === notaInput
    );

    state.submittedNote = sentNote;
    state.pendingReplacementNote = "";
    setWaitingForJurors(false);

    if (sentNote) {
        if (keepEditing) {
            setMessage(
                evaluationMessage,
                `Enviada a nota ${sentNote}. Digite a nova nota.`,
                "success"
            );
            return;
        }

        lockSubmittedNote(sentNote);
        return;
    }

    resetNoteEntry({
        clearValue: poemChanged || document.activeElement !== notaInput
    });
    setMessage(evaluationMessage, "");
}

function renderAdminData(data = {}) {
    const poem = data.poema || data || {};
    const medias = data.medias || {};
    const jurados = Array.isArray(data.jurados) ? data.jurados : [];
    const jurorSlots = Array.from({ length: 8 }, (_, index) => {
        return jurados[index] || {
            id: index + 1,
            nome: `Nome do Jurado ${index + 1}`,
            nota: ""
        };
    });

    adminTitle.textContent = poem.nome || poem.titulo || (poem.id ? `Poema ${poem.id}` : "Nome do Poema");
    adminPoemAuthor.textContent = poem.autor || "Nome do Autor";
    adminPoemDeclamador.textContent = poem.declamador || poem.titulo || "Nome do Declamador";
    mediaDeclamacao.textContent = formatGrade(medias.declamacao ?? data.mediaDeclamacao);
    mediaPoema.textContent = formatGrade(medias.poema ?? data.mediaPoema);
    mediaGeral.textContent = formatGrade(medias.geral ?? data.mediaGeral);
    renderCurrentPoemControl(data);

    adminJurorList.replaceChildren(...jurorSlots.map((jurado) => {
        const row = document.createElement("div");
        const name = document.createElement("span");
        const note = document.createElement("strong");

        row.className = "admin-juror-row";
        name.className = "admin-juror-name";
        note.className = "ticket-value";
        name.textContent = jurado.nome || `Nome do Jurado ${jurado.id || ""}`.trim();
        note.textContent = formatGrade(jurado.nota, { placeholder: "--------" });

        row.append(name, note);
        return row;
    }));

    fitAdminHeader();
}

async function loadCurrentPoem({ silent = false } = {}) {
    if (poemRefreshInProgress) {
        return;
    }

    poemRefreshInProgress = true;
    const previousPoemId = state.poema?.id ?? "";

    if (!silent) {
        setMessage(poemMessage, "Carregando poema atual...", "success");
        renderPoem(DEMO_POEM);
    }

    if (!APPS_SCRIPT_URL) {
        if (!silent) {
            setMessage(poemMessage, "");
        }
        poemRefreshInProgress = false;
        return;
    }

    try {
        const response = await fetch(buildScriptUrl({
            acao: "poema",
            token: state.token
        }), {
            method: "GET",
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("Não foi possível carregar o poema.");
        }

        const data = await response.json();

        if (data.erro) {
            throw new Error(data.erro);
        }

        renderPoem(data);
        applyEvaluationState(data, {
            poemChanged: String(previousPoemId) !== String(data.id ?? "")
        });
        setMessage(poemMessage, "");
    } catch (error) {
        if (!silent) {
            setMessage(poemMessage, "Não foi possível atualizar pela planilha. Exibindo o exemplo local.");
        }
    } finally {
        poemRefreshInProgress = false;
    }
}

async function loadAdminData({ silent = false } = {}) {
    if (adminRefreshInProgress) {
        return;
    }

    adminRefreshInProgress = true;

    if (!silent) {
        setMessage(adminMessage, "Carregando notas...", "success");
        renderAdminData({});
    }

    if (!APPS_SCRIPT_URL) {
        if (!silent) {
            setMessage(adminMessage, "Configure a URL do Apps Script para carregar as notas.");
        }
        adminRefreshInProgress = false;
        return;
    }

    try {
        const response = await fetch(buildScriptUrl({
            acao: "admin",
            token: state.token
        }), {
            method: "GET",
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("Não foi possível carregar as notas.");
        }

        const data = await response.json();

        if (data.erro || data.ok === false) {
            throw new Error(data.erro || "Não foi possível carregar as notas.");
        }

        const confirmedPoemId = String(data.controle?.poemaAtualId || data.poema?.id || "").trim();
        const pendingConfirmation = state.pendingCurrentPoemConfirmation;
        const shouldWaitForConfirmation = Boolean(
            pendingConfirmation
            && confirmedPoemId !== pendingConfirmation.poemId
            && Date.now() < pendingConfirmation.expiresAt
        );

        if (shouldWaitForConfirmation) {
            return;
        }

        renderAdminData(data);
        setMessage(adminMessage, "", "success");
    } catch (error) {
        setMessage(adminMessage, error.message || "Não foi possível carregar as notas.");
    } finally {
        adminRefreshInProgress = false;
    }
}

async function changeCurrentPoem(poemId) {
    const selectedPoemId = String(poemId || "").trim();
    const previousPoemId = state.currentPoemId;

    if (!selectedPoemId) {
        return;
    }

    if (selectedPoemId === state.currentPoemId) {
        setMessage(adminMessage, `Poema atual já está em ${selectedPoemId}.`, "success");
        return;
    }

    if (!APPS_SCRIPT_URL) {
        setMessage(adminMessage, "Configure a URL do Apps Script para alterar o poema atual.");
        return;
    }

    if (!state.token) {
        setMessage(adminMessage, "Faça login como administrador para alterar o poema atual.");
        return;
    }

    state.currentPoemPickerTouched = false;
    state.pendingCurrentPoemConfirmation = null;
    renderCurrentPoemControl({
        controle: {
            poemaAtualId: selectedPoemId,
            categorias: state.currentPoemGroups
        }
    });
    state.pendingCurrentPoemConfirmation = {
        poemId: selectedPoemId,
        previousPoemId,
        expiresAt: Date.now() + AUTO_REFRESH_MS
    };
    setCurrentPoemPickerDisabled(true);
    setMessage(adminMessage, `Poema atual selecionado: ${selectedPoemId}. Confirmando na planilha...`, "success");

    try {
        await fetch(APPS_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify({
                acao: "poemaAtual",
                token: state.token,
                poemaId: selectedPoemId
            })
        });

        setMessage(adminMessage, `Poema atual selecionado: ${selectedPoemId}.`, "success");
    } catch (error) {
        state.pendingCurrentPoemConfirmation = null;
        setMessage(adminMessage, error.message || "Não foi possível alterar o poema atual.");
        renderCurrentPoemControl({
            controle: {
                poemaAtualId: previousPoemId,
                categorias: state.currentPoemGroups
            }
        });
    } finally {
        setCurrentPoemPickerDisabled(false);
    }
}

async function loadClassificationData({ silent = false } = {}) {
    if (classificationRefreshInProgress) {
        return;
    }

    classificationRefreshInProgress = true;

    if (!silent) {
        setMessage(classificationMessage, "Carregando classificação...", "success");
        renderClassification();
    }

    if (!APPS_SCRIPT_URL) {
        setMessage(classificationMessage, "Configure a URL do Apps Script para carregar a classificação.");
        classificationRefreshInProgress = false;
        return;
    }

    try {
        const response = await fetch(buildScriptUrl({
            acao: "classificacao",
            token: state.token
        }), {
            method: "GET",
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("Não foi possível carregar a classificação.");
        }

        const data = await response.json();

        if (data.erro || data.ok === false) {
            throw new Error(data.erro || "Não foi possível carregar a classificação.");
        }

        state.classificationData = data;
        renderClassification();
        setMessage(classificationMessage, "", "success");
    } catch (error) {
        setMessage(classificationMessage, error.message || "Não foi possível carregar a classificação.");
    } finally {
        classificationRefreshInProgress = false;
    }
}

function startAutoRefresh() {
    if (autoRefreshTimer) {
        return;
    }

    autoRefreshTimer = window.setInterval(refreshCurrentScreen, AUTO_REFRESH_MS);
}

function stopAutoRefresh() {
    if (!autoRefreshTimer) {
        return;
    }

    window.clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
}

function refreshCurrentScreen() {
    if (evaluationScreen.classList.contains("is-active")) {
        loadCurrentPoem({ silent: true });
        return;
    }

    if (adminScreen.classList.contains("is-active")) {
        loadAdminData({ silent: true });
        return;
    }

    if (classificationScreen.classList.contains("is-active")) {
        loadClassificationData({ silent: true });
    }
}

function getClassificationRows() {
    const categories = state.classificationData?.categorias || [];
    const category = categories.find((item) => item.id === state.selectedCategory);
    return category?.criterios?.[state.selectedCriterion] || [];
}

function renderClassification() {
    const rows = getClassificationRows();
    const slots = Array.from({ length: 3 }, (_, index) => rows[index] || {
        posicao: `${index + 1}º`,
        declamador: "",
        autor: "",
        nomePoema: "",
        turma: "",
        nota: ""
    });

    categoryButtons.forEach((button) => {
        button.classList.toggle("is-selected", button.dataset.category === state.selectedCategory);
    });

    criterionButtons.forEach((button) => {
        button.classList.toggle("is-selected", button.dataset.criterion === state.selectedCriterion);
    });

    classificationRanking.replaceChildren(...slots.map((item, index) => {
        const row = document.createElement("article");
        const position = document.createElement("div");
        const info = document.createElement("div");
        const main = document.createElement("div");
        const sub = document.createElement("div");
        const turma = document.createElement("span");
        const poem = document.createElement("strong");
        const score = document.createElement("strong");

        row.className = "ranking-row";
        position.className = "ranking-position";
        info.className = "ranking-info";
        main.className = "ranking-main";
        sub.className = "ranking-sub";
        score.className = "ranking-score";

        position.textContent = item.posicao || `${index + 1}º`;
        main.textContent = buildRankingTitle(item);
        turma.textContent = item.turma || "Turma";
        poem.textContent = item.nomePoema || "Poema";
        score.textContent = formatGrade(item.nota, { placeholder: "Nota" });

        sub.append(turma, poem);
        info.append(main, sub);
        row.append(position, info, score);
        return row;
    }));
}

function buildRankingTitle(item) {
    const autor = item.autor || "Nome do Autor";
    const declamador = item.declamador || "declamador";

    if (state.selectedCriterion === "declamacao") {
        return declamador;
    }

    if (state.selectedCriterion === "poema") {
        return autor;
    }

    return `${autor}/${declamador}`;
}

function sanitizeNoteInput() {
    if (notaInput.readOnly) {
        return;
    }

    const separatorIndex = notaInput.value.search(/[.,]/);
    const integerPortion = separatorIndex >= 0
        ? notaInput.value.slice(0, separatorIndex)
        : notaInput.value;
    const cleanValue = integerPortion.replace(/[^\d]/g, "");

    if (notaInput.value !== cleanValue) {
        notaInput.value = cleanValue;
    }
}

function validateNote() {
    sanitizeNoteInput();

    const noteText = notaInput.value.trim();
    const note = Number(noteText);

    if (!/^\d+$/.test(noteText) || !Number.isInteger(note) || note < 50 || note > 100) {
        throw new Error("A nota precisa ser um número inteiro de 50 a 100.");
    }

    return noteText;
}

function getEvaluationPayload() {
    const formData = new FormData(evaluationForm);
    const note = validateNote();

    return {
        tipo: "avaliacao",
        acao: "avaliacao",
        dataHora: new Date().toISOString(),
        avaliador: state.usuario,
        jurado: formData.get("jurado"),
        juradoId: state.juradoId,
        login: state.login,
        token: state.token,
        poemaId: state.poema?.id ?? "",
        declamador: state.poema?.declamador ?? state.poema?.titulo ?? "",
        autor: state.poema?.autor ?? "",
        turma: state.poema?.turma ?? "",
        nota: note
    };
}

function shouldSendEvaluation(note) {
    if (!state.submittedNote) {
        return true;
    }

    if (!state.isEditingSubmittedNote) {
        setMessage(
            evaluationMessage,
            `Enviada a nota ${state.submittedNote}. Clique no ícone de edição para alterar.`,
            "success"
        );
        return false;
    }

    if (note === state.submittedNote) {
        lockSubmittedNote(note);
        return false;
    }

    state.pendingReplacementNote = "";
    return true;
}

async function sendEvaluation(payload) {
    if (!APPS_SCRIPT_URL) {
        return { localOnly: true };
    }

    if (!payload.token) {
        throw new Error("Faça login pela planilha para gravar a nota deste jurado.");
    }

    const response = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {
            "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload)
    });

    return response;
}

async function restoreSavedSession() {
    const savedSession = readSavedSessionEverywhere();

    if (!savedSession) {
        setScreen("login");
        return;
    }

    state.usuario = savedSession.usuario || "";
    state.juradoId = savedSession.juradoId ?? "";
    state.login = savedSession.login || "";
    state.token = savedSession.token || "";
    state.selectedCategory = savedSession.selectedCategory || "A";
    state.selectedCriterion = savedSession.selectedCriterion || "declamacao";
    setMessage(loginMessage, "");

    if (String(state.juradoId) === "0") {
        const screen = savedSession.currentScreen === "classification" ? "classification" : "admin";

        setScreen(screen);

        if (screen === "classification") {
            await loadClassificationData();
            return;
        }

        await loadAdminData();
        return;
    }

    document.querySelector("#jurado").value = state.usuario;
    setWaitingForJurors(false);
    setScreen("evaluation");
    await loadCurrentPoem();
}

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const usuario = document.querySelector("#usuario").value.trim();
    const senha = document.querySelector("#senha").value.trim();

    if (!usuario || !senha) {
        setMessage(loginMessage, "Preencha nome e senha.");
        return;
    }

    let credential;

    try {
        credential = await authenticateUser(usuario, senha);
    } catch (error) {
        setMessage(loginMessage, error.message || "Login ou senha incorretos.");
        return;
    }

    state.usuario = credential.nome || usuario;
    state.juradoId = credential.juradoId ?? "";
    state.login = credential.login || usuario;
    state.token = credential.token || "";
    setMessage(loginMessage, "");

    if (String(state.juradoId) === "0") {
        state.currentScreen = "admin";
        saveSessionEverywhere();
        setScreen("admin");
        await loadAdminData();
        return;
    }

    document.querySelector("#jurado").value = state.usuario;
    setWaitingForJurors(false);
    state.currentScreen = "evaluation";
    saveSessionEverywhere();
    setScreen("evaluation");
    await loadCurrentPoem();
});

senhaInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        loginForm.requestSubmit();
    }
});

evaluationForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    let payload;

    try {
        payload = getEvaluationPayload();
    } catch (error) {
        setMessage(evaluationMessage, error.message);
        notaInput.focus();
        return;
    }

    if (!shouldSendEvaluation(payload.nota)) {
        return;
    }

    const previousSubmittedNote = state.submittedNote;

    state.pendingNoteConfirmation = {
        poemId: String(payload.poemaId || ""),
        note: String(payload.nota),
        previousSubmittedNote,
        expiresAt: Date.now() + AUTO_REFRESH_MS
    };
    sendButton.disabled = true;
    lockSubmittedNote(payload.nota);

    try {
        const result = await sendEvaluation(payload);

        if (result.localOnly) {
            console.info("Avaliação pronta para envio:", payload);
        }

        document.querySelector("#jurado").value = state.usuario;
    } catch (error) {
        state.pendingNoteConfirmation = null;
        restoreNoteAfterSendFailure(payload.nota, previousSubmittedNote);
        setMessage(evaluationMessage, error.message || "Não foi possível enviar a avaliação. Tente novamente.");
    } finally {
        sendButton.disabled = false;
    }
});

notaInput.addEventListener("input", sanitizeNoteInput);

notaInput.addEventListener("keydown", (event) => {
    if (notaInput.readOnly) {
        if (event.key === "Enter") {
            event.preventDefault();
            setMessage(
                evaluationMessage,
                `Enviada a nota ${state.submittedNote}. Clique no ícone de edição para alterar.`,
                "success"
            );
            editNoteButton.focus();
        }
        return;
    }

    if ([".", ",", "-", "+", "e", "E"].includes(event.key)) {
        event.preventDefault();
    }

    if (event.key === "Enter") {
        event.preventDefault();
        evaluationForm.requestSubmit();
    }
});

editNoteButton.addEventListener("click", unlockSubmittedNoteForEditing);

currentPoemCategoryButtons.forEach((button) => {
    button.addEventListener("click", () => {
        state.currentPoemCategory = button.dataset.currentCategory || "A";
        state.currentPoemPickerTouched = true;
        renderCurrentPoemControl({
            controle: {
                poemaAtualId: state.currentPoemId,
                categorias: state.currentPoemGroups
            }
        });
    });
});

currentPoemSelect.addEventListener("change", () => {
    changeCurrentPoem(currentPoemSelect.value);
});

categoryButtons.forEach((button) => {
    button.addEventListener("click", () => {
        state.selectedCategory = button.dataset.category || "A";
        saveSession();
        saveSessionEverywhere();
        renderClassification();
    });
});

criterionButtons.forEach((button) => {
    button.addEventListener("click", () => {
        state.selectedCriterion = button.dataset.criterion || "declamacao";
        saveSession();
        saveSessionEverywhere();
        renderClassification();
    });
});

logoutButton.addEventListener("click", logout);
adminLogoutButton.addEventListener("click", logout);
classificationLogoutButton.addEventListener("click", logout);

adminRefreshButton.addEventListener("click", () => {
    loadAdminData();
});

openClassificationButton.addEventListener("click", async () => {
    setScreen("classification");
    await loadClassificationData();
});

backToAdminButton.addEventListener("click", async () => {
    setScreen("admin");
    await loadAdminData();
});

window.addEventListener("resize", () => {
    if (evaluationScreen.classList.contains("is-active")) {
        fitPoemHeader();
        fitPoemText();
    }

    if (adminScreen.classList.contains("is-active")) {
        fitAdminHeader();
    }
});

window.addEventListener("beforeunload", () => {
    saveSessionEverywhere();
});

function logout() {
    clearSavedSessionEverywhere();
    state.usuario = "";
    state.juradoId = "";
    state.login = "";
    state.token = "";
    state.poema = null;
    state.submittedNote = "";
    state.pendingReplacementNote = "";
    state.isEditingSubmittedNote = false;
    state.classificationData = null;
    state.currentPoemCategory = "";
    state.currentPoemId = "";
    state.currentPoemGroups = [];
    state.currentPoemPickerTouched = false;
    state.pendingCurrentPoemConfirmation = null;
    state.pendingNoteConfirmation = null;
    evaluationForm.reset();
    resetNoteEntry();
    loginForm.reset();
    setWaitingForJurors(false);
    setMessage(evaluationMessage, "");
    setMessage(poemMessage, "");
    setMessage(adminMessage, "");
    setMessage(classificationMessage, "");
    setScreen("login");
}

restoreSavedSession();
