const SUPABASE_URL = "https://mobuouauxjknoasjvwgi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_NkklrlYo6XN1c3qKGmNUYg_jqlvVE0V";
const telegram = window.Telegram?.WebApp;

if (telegram) {
    telegram.ready();
    telegram.expand();
}

const botaoTema = document.getElementById("alternar-tema");
const preferenciaEscura = window.matchMedia("(prefers-color-scheme: dark)");
const chaveTema = "tema-calendario";
const temaSalvo = localStorage.getItem(chaveTema);

function aplicarTema(tema) {
    const escuro = tema === "escuro";

    document.documentElement.dataset.theme = tema;
    botaoTema.setAttribute(
        "aria-label",
        escuro ? "Ativar modo claro" : "Ativar modo escuro"
    );
    botaoTema.setAttribute("aria-pressed", String(escuro));
    botaoTema.title = escuro ? "Ativar modo claro" : "Ativar modo escuro";
}

aplicarTema(
    temaSalvo === "claro" || temaSalvo === "escuro"
        ? temaSalvo
        : preferenciaEscura.matches ? "escuro" : "claro"
);

botaoTema.addEventListener("click", () => {
    const novoTema =
        document.documentElement.dataset.theme === "escuro" ? "claro" : "escuro";

    localStorage.setItem(chaveTema, novoTema);
    aplicarTema(novoTema);
});

preferenciaEscura.addEventListener("change", evento => {
    if (!localStorage.getItem(chaveTema)) {
        aplicarTema(evento.matches ? "escuro" : "claro");
    }
});

let eventos = {};
let programacoes = {};
let carregando = false;
let erroCarregamento = false;
let dataSelecionada = null;
let usuarioAdmin = false;


const hoje = new Date();

let dataAtual = new Date(
    hoje.getFullYear(),
    hoje.getMonth(),
    1
);



const titulo = document.getElementById("mes-ano");
const anoCalendario = document.getElementById("ano-calendario");
const diasContainer = document.getElementById("dias");
const detalhes = document.getElementById("detalhes");



async function carregarEventos() {
    carregando = true;
    erroCarregamento = false;

    detalhes.textContent = "Carregando eventos...";
    mostrarCalendario();

    try {
        const headers = {
            "Content-Type": "application/json",
            apikey: SUPABASE_PUBLISHABLE_KEY
        };

        if (telegram?.initData) {
            headers["X-Telegram-Init-Data"] = telegram.initData;
        }

        const resposta = await fetch(
            `${SUPABASE_URL}/functions/v1/calendario-eventos`,
            {
                method: "POST",
                headers,
                body: "{}"
            }
        );
        const resultado = await resposta.json();

        if (!resposta.ok) {
            throw new Error(
                resultado.error || "Não foi possível consultar os eventos."
            );
        }

        usuarioAdmin = resultado.admin === true;
        eventos = {};
        programacoes = {};

        (resultado.eventos || []).forEach(evento => {
            eventos[evento.data] = evento;
        });

        (resultado.programacoes || []).forEach(programacao => {
            programacoes[programacao.data] = programacao;
        });

        carregando = false;
        erroCarregamento = false;

        mostrarCalendario();

        if (dataSelecionada) {
            mostrarDetalhes(
                dataSelecionada,
                eventos[dataSelecionada],
                programacoes[dataSelecionada]
            );
        } else {
            detalhes.textContent =
                "Selecione uma data para ver as informações.";
        }

        console.log("Eventos carregados.");

    } catch (erro) {
        console.error("Erro ao carregar eventos:", erro);

        carregando = false;
        erroCarregamento = true;

        diasContainer.replaceChildren();
        titulo.textContent = "";
        anoCalendario.textContent = "";

        detalhes.replaceChildren();

        const mensagem = document.createElement("p");
        mensagem.textContent = erro instanceof Error
            ? `Não foi possível carregar os eventos: ${erro.message}`
            : "Não foi possível carregar os eventos.";

        const botao = document.createElement("button");
        botao.type = "button";
        botao.textContent = "Tentar novamente";
        botao.classList.add("botao-recarregar");

        botao.addEventListener("click", carregarEventos);

        detalhes.append(mensagem, botao);
    }
}



function mostrarCalendario() {
    diasContainer.replaceChildren();

    if (carregando || erroCarregamento) {
        return;
    }

    const ano = dataAtual.getFullYear();
    const mes = dataAtual.getMonth();

    titulo.textContent = dataAtual.toLocaleDateString(
        "pt-BR",
        {
            month: "short"
        }
    ).replace(".", "");
    anoCalendario.textContent = ano;

    const primeiroDia = new Date(ano, mes, 1).getDay();
    const totalDias = new Date(ano, mes + 1, 0).getDate();

    

    for (let i = 0; i < primeiroDia; i++) {
        const vazio = document.createElement("span");
        vazio.classList.add("dia-vazio");
        vazio.setAttribute("aria-hidden", "true");

        diasContainer.appendChild(vazio);
    }

  

    for (let dia = 1; dia <= totalDias; dia++) {
        const chave =
            `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

        const evento = eventos[chave];
        const programacao = programacoes[chave];

        const dataDoDia = new Date(ano, mes, dia);
        const dataHoje = new Date(
            hoje.getFullYear(),
            hoje.getMonth(),
            hoje.getDate()
        );

        const passado = dataDoDia < dataHoje;

        const botao = document.createElement("button");

        botao.type = "button";
        botao.classList.add("dia");

        if (passado) {
            botao.classList.add("passado");
        } else if (evento || programacao) {
            botao.classList.add("ocupado");
        } else {
            botao.classList.add("disponivel");
        }

        if (chave === dataSelecionada) {
            botao.classList.add("selecionado");
            botao.setAttribute("aria-pressed", "true");
        } else {
            botao.setAttribute("aria-pressed", "false");
        }

        botao.textContent = dia;

        let situacao = "disponível";

        if (passado) {
            situacao = programacao
                ? "data passada, programação disponível"
                : "data passada";
        } else if (evento || programacao) {
            situacao = "ocupado";
        }

        botao.setAttribute(
            "aria-label",
            `${dia}, ${situacao}`
        );

        botao.addEventListener("click", () => {
            dataSelecionada = chave;

            mostrarCalendario();
            mostrarDetalhes(chave, evento, programacao);
        });

        diasContainer.appendChild(botao);
    }
}



function mostrarDetalhes(data, evento, programacao) {
    detalhes.replaceChildren();

    const dataFormatada = data.split("-").reverse().join("/");
    const tituloDetalhes = document.createElement("h3");

    tituloDetalhes.textContent = dataFormatada;
    detalhes.appendChild(tituloDetalhes);

    

    const [ano, mes, dia] = data.split("-").map(Number);
    const dataEscolhida = new Date(ano, mes - 1, dia);
    const dataHoje = new Date(
        hoje.getFullYear(),
        hoje.getMonth(),
        hoje.getDate()
    );

    const dataPassada = dataEscolhida < dataHoje;

    if (dataPassada) {
        const mensagem = document.createElement("p");
        mensagem.classList.add("status-data");
        mensagem.textContent = programacao
            ? "Esta data já passou. Programação:"
            : "Esta data já passou!";
        detalhes.appendChild(mensagem);
        if (!programacao) {
            return;
        }
    }

    if (!evento && !programacao) {
        const mensagem = document.createElement("p");
        mensagem.classList.add("status-data");

        mensagem.textContent = "Data disponível!";

        detalhes.appendChild(mensagem);
        return;
    }

    

    if (evento) {
        const status = document.createElement("p");
        status.classList.add("status-ocupado");
        status.textContent = "Data ocupada!";
        detalhes.appendChild(status);
    }

    if (programacao) {
        const tituloProgramacao = document.createElement("h4");
        tituloProgramacao.classList.add("titulo-programacao");
        tituloProgramacao.textContent = "Programação do dia";

        const conteudoProgramacao = document.createElement("div");
        conteudoProgramacao.classList.add("programacao-publica");
        conteudoProgramacao.textContent = programacao.conteudo;

        detalhes.append(tituloProgramacao, conteudoProgramacao);
    }

    if (dataPassada || !evento || !usuarioAdmin) {
        return;
    }

    adicionarInformacao("Tema", evento.tema || "Não informado");

    const horario = evento.horario
        ? evento.horario.slice(0, 5)
        : "Não informado";

    adicionarInformacao("Horário", horario);
    adicionarInformacao("FK", evento.fk || "Sem FK");

    if (evento.observacoes) {
        adicionarInformacao("Observações", evento.observacoes);
    }
}



function adicionarInformacao(rotulo, valor) {
    const paragrafo = document.createElement("p");
    const destaque = document.createElement("strong");

    destaque.textContent = `${rotulo}: `;

    paragrafo.appendChild(destaque);
    paragrafo.appendChild(document.createTextNode(String(valor)));

    detalhes.appendChild(paragrafo);
}



document.getElementById("anterior").addEventListener("click", () => {
    dataAtual.setMonth(dataAtual.getMonth() - 1);
    dataSelecionada = null;

    mostrarCalendario();
    detalhes.textContent =
        "Selecione uma data para ver as informações.";
});

document.getElementById("proximo").addEventListener("click", () => {
    dataAtual.setMonth(dataAtual.getMonth() + 1);
    dataSelecionada = null;

    mostrarCalendario();
    detalhes.textContent =
        "Selecione uma data para ver as informações.";
});



document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        carregarEventos();
    }
});



carregarEventos();
