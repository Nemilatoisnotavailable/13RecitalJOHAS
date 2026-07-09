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
    classificationData: null,
    selectedCategory: "A",
    selectedCriterion: "declamacao",
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
const adminTitle = document.querySelector("#adminTitle");
const adminPoemAuthor = document.querySelector("#adminPoemAuthor");
const adminPoemDeclamador = document.querySelector("#adminPoemDeclamador");
const adminJurorList = document.querySelector("#adminJurorList");
const mediaDeclamacao = document.querySelector("#mediaDeclamacao");
const mediaPoema = document.querySelector("#mediaPoema");
const mediaGeral = document.querySelector("#mediaGeral");
const classificationRanking = document.querySelector("#classificationRanking");

const loginCredentials = Array.from(document.querySelectorAll("#loginCredentials [data-login][data-senha]"));
const senhaInput = document.querySelector("#senha");
const notaInput = document.querySelector("#nota");
const gradeBlock = document.querySelector("#gradeBlock");
const waitingPanel = document.querySelector("#waitingPanel");
const sendButton = evaluationForm.querySelector(".send-button");
const categoryButtons = Array.from(document.querySelectorAll("[data-category]"));
const criterionButtons = Array.from(document.querySelectorAll("[data-criterion]"));

const POEM_FONT_MAX = 2.25;
const POEM_FONT_MIN = 0.74;
const POEM_FONT_STEP = 0.05;
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

function setMessage(element, message = "", type = "error") {
    element.textContent = message;
    element.classList.toggle("success", type === "success");
}

function setWaitingForJurors(isWaiting) {
    gradeBlock.hidden = isWaiting;
    waitingPanel.hidden = !isWaiting;
    notaInput.disabled = isWaiting;
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

        while (size > min && element.scrollWidth > element.clientWidth) {
            size -= step;
            element.style.setProperty(cssVariable, `${size.toFixed(2)}rem`);
        }
    });
}

function fitPoemText() {
    poemText.classList.remove("is-scrollable");
    poemText.style.setProperty("--poem-font-size", `${POEM_FONT_MAX}rem`);

    requestAnimationFrame(() => {
        let size = POEM_FONT_MAX;

        while (
            size > POEM_FONT_MIN
            && poemText.scrollHeight > poemText.clientHeight
        ) {
            size -= POEM_FONT_STEP;
            poemText.style.setProperty("--poem-font-size", `${size.toFixed(2)}rem`);
        }

        if (poemText.scrollHeight > poemText.clientHeight) {
            poemText.classList.add("is-scrollable");
        }
    });
}

function renderPoem(poem) {
    state.poema = poem;
    const poemLabel = poem.nome || poem.titulo || (poem.id ? `Poema ${poem.id}` : "Nome do Poema");

    poemTitle.textContent = poemLabel;
    poemAuthor.textContent = poem.autor || "Nome do Autor";
    poemDeclamador.textContent = poem.declamador || poem.titulo || "Nome do Declamador";
    poemText.textContent = poem.texto || "";
    fitElementFont(poemTitle, "--title-font-size", 6, 2.7, 0.12);
    fitPoemText();
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

    fitElementFont(adminTitle, "--admin-title-font-size", 6.2, 2.7, 0.12);
}

async function loadCurrentPoem({ silent = false } = {}) {
    if (poemRefreshInProgress) {
        return;
    }

    poemRefreshInProgress = true;

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
        const response = await fetch(buildScriptUrl({ acao: "poema" }), {
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

        renderAdminData(data);
        setMessage(adminMessage, "", "success");
    } catch (error) {
        setMessage(adminMessage, error.message || "Não foi possível carregar as notas.");
    } finally {
        adminRefreshInProgress = false;
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
    const savedSession = readSavedSession();

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
        setScreen("admin");
        await loadAdminData();
        return;
    }

    document.querySelector("#jurado").value = state.usuario;
    setWaitingForJurors(false);
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

    sendButton.disabled = true;
    setMessage(evaluationMessage, "Enviando avaliação...", "success");

    try {
        const result = await sendEvaluation(payload);

        if (result.localOnly) {
            console.info("Avaliação pronta para envio:", payload);
        }

        setMessage(evaluationMessage, "", "success");
        evaluationForm.reset();
        document.querySelector("#jurado").value = state.usuario;
        setWaitingForJurors(true);
    } catch (error) {
        setMessage(evaluationMessage, error.message || "Não foi possível enviar a avaliação. Tente novamente.");
    } finally {
        sendButton.disabled = false;
    }
});

notaInput.addEventListener("input", sanitizeNoteInput);

notaInput.addEventListener("keydown", (event) => {
    if ([".", ",", "-", "+", "e", "E"].includes(event.key)) {
        event.preventDefault();
    }

    if (event.key === "Enter") {
        event.preventDefault();
        evaluationForm.requestSubmit();
    }
});

categoryButtons.forEach((button) => {
    button.addEventListener("click", () => {
        state.selectedCategory = button.dataset.category || "A";
        saveSession();
        renderClassification();
    });
});

criterionButtons.forEach((button) => {
    button.addEventListener("click", () => {
        state.selectedCriterion = button.dataset.criterion || "declamacao";
        saveSession();
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
        fitElementFont(poemTitle, "--title-font-size", 6, 2.7, 0.12);
        fitPoemText();
    }

    if (adminScreen.classList.contains("is-active")) {
        fitElementFont(adminTitle, "--admin-title-font-size", 6.2, 2.7, 0.12);
    }
});

function logout() {
    clearSavedSession();
    state.usuario = "";
    state.juradoId = "";
    state.login = "";
    state.token = "";
    state.poema = null;
    state.classificationData = null;
    evaluationForm.reset();
    loginForm.reset();
    setWaitingForJurors(false);
    setMessage(evaluationMessage, "");
    setMessage(poemMessage, "");
    setMessage(adminMessage, "");
    setMessage(classificationMessage, "");
    setScreen("login");
}

restoreSavedSession();
