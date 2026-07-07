const APPS_SCRIPT_URL = "";

const DEMO_POEM = {
    id: 1,
    titulo: "Sir Semtopete",
    autor: "Sem Franja de Assis",
    texto: "O vento sorriu,\nna testa mora o brilho.\nPente aposentou.",
    turma: "5º Ano A"
};

const ACCESS_PASSWORD = "johas2026";

const state = {
    usuario: "",
    poema: null
};

const loginScreen = document.querySelector("#loginScreen");
const evaluationScreen = document.querySelector("#evaluationScreen");
const loginForm = document.querySelector("#loginForm");
const evaluationForm = document.querySelector("#evaluationForm");
const logoutButton = document.querySelector("#logoutButton");
const loginMessage = document.querySelector("#loginMessage");
const evaluationMessage = document.querySelector("#evaluationMessage");
const poemMessage = document.querySelector("#poemMessage");

const poemId = document.querySelector("#poemId");
const poemTurma = document.querySelector("#poemTurma");
const poemTitle = document.querySelector("#evaluationTitle");
const poemAuthor = document.querySelector("#poemAuthor");
const poemText = document.querySelector("#poemText");

function setScreen(screenName) {
    const isEvaluation = screenName === "evaluation";

    loginScreen.classList.toggle("is-active", !isEvaluation);
    evaluationScreen.classList.toggle("is-active", isEvaluation);
    document.body.classList.toggle("evaluation-open", isEvaluation);
}

function setMessage(element, message = "", type = "error") {
    element.textContent = message;
    element.classList.toggle("success", type === "success");
}

function renderPoem(poem) {
    state.poema = poem;
    poemId.textContent = `Poema ${poem.id ?? ""}`;
    poemTurma.textContent = poem.turma || "Turma";
    poemTitle.textContent = poem.titulo || "Poema sem titulo";
    poemAuthor.textContent = poem.autor ? `Autor: ${poem.autor}` : "";
    poemText.textContent = poem.texto || "";
}

async function loadCurrentPoem() {
    setMessage(poemMessage, "Carregando poema atual...", "success");
    renderPoem(DEMO_POEM);

    if (!APPS_SCRIPT_URL) {
        setMessage(poemMessage, "");
        return;
    }

    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: "GET",
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("Nao foi possivel carregar o poema.");
        }

        const data = await response.json();

        if (data.erro) {
            throw new Error(data.erro);
        }

        renderPoem(data);
        setMessage(poemMessage, "");
    } catch (error) {
        setMessage(poemMessage, "Nao foi possivel atualizar pela planilha. Exibindo o exemplo local.");
    }
}

function getEvaluationPayload() {
    const formData = new FormData(evaluationForm);

    return {
        tipo: "avaliacao",
        dataHora: new Date().toISOString(),
        avaliador: state.usuario,
        poemaId: state.poema?.id ?? "",
        declamador: state.poema?.titulo ?? "",
        autor: state.poema?.autor ?? "",
        turma: state.poema?.turma ?? "",
        interpretacao: formData.get("interpretacao"),
        diccao: formData.get("diccao"),
        memorizacao: formData.get("memorizacao"),
        presenca: formData.get("presenca"),
        observacoes: formData.get("observacoes")
    };
}

async function sendEvaluation(payload) {
    if (!APPS_SCRIPT_URL) {
        return { localOnly: true };
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

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const usuario = document.querySelector("#usuario").value.trim();
    const senha = document.querySelector("#senha").value.trim();

    if (!usuario || !senha) {
        setMessage(loginMessage, "Preencha nome e senha.");
        return;
    }

    if (senha !== ACCESS_PASSWORD) {
        setMessage(loginMessage, "Senha incorreta.");
        return;
    }

    state.usuario = usuario;
    setMessage(loginMessage, "");
    setScreen("evaluation");
    await loadCurrentPoem();
});

evaluationForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const button = evaluationForm.querySelector("button");
    const payload = getEvaluationPayload();

    button.disabled = true;
    setMessage(evaluationMessage, "Enviando avaliacao...", "success");

    try {
        const result = await sendEvaluation(payload);

        if (result.localOnly) {
            console.info("Avaliacao pronta para envio:", payload);
            setMessage(evaluationMessage, "Avaliação registrada nesta sessão. Configure a URL do Apps Script para gravar na planilha.", "success");
        } else {
            setMessage(evaluationMessage, "Avaliação enviada com sucesso.", "success");
        }

        evaluationForm.reset();
    } catch (error) {
        setMessage(evaluationMessage, "Nao foi possivel enviar a avaliacao. Tente novamente.");
    } finally {
        button.disabled = false;
    }
});

logoutButton.addEventListener("click", () => {
    state.usuario = "";
    state.poema = null;
    evaluationForm.reset();
    loginForm.reset();
    setMessage(evaluationMessage, "");
    setMessage(poemMessage, "");
    setScreen("login");
});

setScreen("login");
