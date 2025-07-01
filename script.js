// Lógica do chatbot será adicionada aqui
const GEMINI_API_KEY = 'SUA_CHAVE_API_AQUI'; // IMPORTANTE: Substitua pela sua chave de API real.

const GEMINI_API_URL_TEXT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
const GEMINI_API_URL_VISION = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent'; // Para modelos que suportam imagem

const chatArea = document.getElementById('chatArea');
const userInput = document.getElementById('userInput');
const settingsPanel = document.getElementById('settingsPanel');
const systemPromptTextarea = document.getElementById('systemPrompt');
const fileInput = document.getElementById('fileInput');

let currentSystemPrompt = "";
let conversationHistory = []; // Para armazenar o histórico da conversa atual

// Carregar system prompt salvo ao iniciar
loadSystemPrompt();

function toggleSettings() {
    settingsPanel.style.display = settingsPanel.style.display === 'none' || settingsPanel.style.display === '' ? 'block' : 'none';
}

function saveSystemPrompt() {
    currentSystemPrompt = systemPromptTextarea.value;
    localStorage.setItem('chatbotSystemPrompt', currentSystemPrompt);
    alert('System prompt salvo!');
    toggleSettings(); // Fecha o painel após salvar
    console.log("System Prompt salvo:", currentSystemPrompt);
}

function loadSystemPrompt() {
    const savedPrompt = localStorage.getItem('chatbotSystemPrompt');
    if (savedPrompt) {
        currentSystemPrompt = savedPrompt;
        systemPromptTextarea.value = savedPrompt;
    }
}

function displayMessage(text, sender, type = 'text', content = null) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);

    if (type === 'error') {
        messageDiv.classList.add('error');
        messageDiv.textContent = text;
    } else if (type === 'text') {
        // Para texto, incluindo respostas do bot que podem ter markdown simples
        // Uma renderização de markdown mais completa exigiria uma biblioteca
        messageDiv.innerHTML = convertMarkdownToHTML(text);
    } else if (type === 'image' && content) {
        const img = document.createElement('img');
        img.src = content; // content é a URL da imagem (e.g., base64)
        img.alt = sender === 'user' ? "Imagem enviada pelo usuário" : "Imagem da IA";
        messageDiv.appendChild(img);
        if (text) { // Se houver texto associado à imagem
             const textNode = document.createElement('p');
             textNode.innerHTML = convertMarkdownToHTML(text);
             messageDiv.appendChild(textNode);
        }
    }
    // Adicionar suporte para vídeo se necessário de forma similar

    chatArea.appendChild(messageDiv);
    chatArea.scrollTop = chatArea.scrollHeight; // Auto-scroll para a última mensagem
}

function convertMarkdownToHTML(text) {
    if (typeof text !== 'string') {
        return '';
    }
    // Converte **bold** para <strong>bold</strong>
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Converte *italic* para <em>italic</em>
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Converte ```code``` para <pre><code>code</code></pre>
    text = text.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    // Converte `code` para <code>code</code>
    text = text.replace(/`(.*?)`/g, '<code>$1</code>');
    // Converte newlines para <br> (importante para respostas do bot)
    text = text.replace(/\n/g, '<br>');
    return text;
}


async function sendMessage() {
    const userText = userInput.value.trim();
    const files = fileInput.files;

    if (!userText && files.length === 0) {
        return;
    }

    if (GEMINI_API_KEY === 'SUA_CHAVE_API_AQUI') {
        displayMessage("Por favor, configure sua chave de API do Gemini em script.js (variável GEMINI_API_KEY).", "bot", "error");
        return;
    }

    let userMessageParts = [];

    if (userText) {
        displayMessage(userText, 'user');
        userMessageParts.push({ text: userText });
    }

    let uploadedFileContent = null; // Para armazenar base64 da imagem
    let fileTypeForApi = null;

    if (files.length > 0) {
        const file = files[0];
        // Por enquanto, vamos focar em imagens para a API Vision
        if (file.type.startsWith('image/')) {
            try {
                uploadedFileContent = await readFileAsBase64(file);
                displayMessage(userText || `Enviou uma imagem: ${file.name}`, 'user', 'image', uploadedFileContent); // Mostra a imagem na UI
                // A API do Gemini espera dados de imagem inline (base64) e o tipo MIME.
                userMessageParts.push({
                    inline_data: {
                        mime_type: file.type,
                        data: uploadedFileContent.split(',')[1] // Remove o prefixo 'data:image/...;base64,'
                    }
                });
                fileTypeForApi = "vision";
            } catch (error) {
                console.error("Erro ao processar arquivo:", error);
                displayMessage("Erro ao processar o arquivo.", "bot", "error");
                return;
            }
        } else {
            displayMessage("No momento, apenas o envio de imagens é suportado para a API Vision.", "bot", "error");
            // Limpar o input de arquivo para evitar reenvio acidental
            fileInput.value = ''; // Reset file input
            return;
        }
    }


    // Adicionar ao histórico da conversa (antes de limpar o input)
    if (userMessageParts.length > 0) {
         conversationHistory.push({ role: "user", parts: userMessageParts });
    }

    userInput.value = '';
    fileInput.value = ''; // Reset file input

    // Preparar payload para a API
    // A API do Gemini espera um histórico de "contents"
    let apiPayloadContents = [];

    // Adicionar system prompt se existir (como primeira mensagem do "model" ou "user" dependendo da preferência da API)
    // Para Gemini, geralmente se configura nas `generationConfig` ou como parte da primeira mensagem do usuário.
    // Aqui, vamos adicioná-lo como uma instrução inicial no histórico, se presente.
    // No entanto, a API do Gemini tem um campo `system_instruction` mais apropriado.
    // Vamos adaptar para usar `system_instruction` se o modelo suportar.
    // Por agora, vamos construir o histórico de mensagens.

    // Construir o histórico para a API
    // O histórico deve alternar entre 'user' e 'model'
    // Se houver um system prompt, ele pode ser adicionado como `system_instruction`
    // ou como uma mensagem inicial. Para Gemini, `system_instruction` é preferível.

    let requestPayload = {
        contents: [...conversationHistory], // Envia o histórico atual
        // Adicionar system_instruction se o modelo suportar (ex: gemini-1.5-pro)
        // system_instruction: currentSystemPrompt ? { parts: [{ text: currentSystemPrompt }] } : undefined,
        generationConfig: {
            // Configurações como temperature, maxOutputTokens, etc.
            // temperature: 0.7,
            // maxOutputTokens: 1000,
        }
    };

    // Se houver um system prompt e o modelo não for vision (ou se for vision e quisermos adicionar como instrução de sistema)
    // Alguns modelos mais recentes do Gemini como o 1.5 Pro suportam `system_instruction`.
    // Para o `gemini-pro` (texto) e `gemini-pro-vision`, o system prompt é geralmente
    // colocado como a primeira mensagem do "user" ou "model" no `contents`.
    // Vamos tentar uma abordagem mais genérica: se houver system prompt, o adicionamos no início do `contents`
    // como uma mensagem do usuário, esperando que o modelo o interprete como instrução.
    // Ou, melhor ainda, para o `gemini-1.5-pro-latest` (que pode ser usado com `v1beta`),
    // podemos usar o campo `systemInstruction`.
    // Por simplicidade e compatibilidade com `gemini-pro` e `gemini-pro-vision`,
    // vamos prependê-lo ao histórico se não for uma conversa contínua com system prompt já implícito.

    // Se temos um system prompt e é o início de uma nova conversa (ou se queremos reforçá-lo),
    // podemos adicioná-lo ao payload.
    // Para `gemini-pro` e `gemini-pro-vision`, o system prompt é melhor tratado como a primeira mensagem do `contents`
    // ou como parte da primeira mensagem do usuário.
    // Se `currentSystemPrompt` existir e `conversationHistory` tiver apenas a última mensagem do usuário,
    // podemos prefixar o system prompt.
    if (currentSystemPrompt && requestPayload.contents.length === 1) { // Apenas a mensagem atual do usuário
        requestPayload.contents.unshift({
            role: "user", // Ou "model" dependendo de como você quer que o Gemini trate
            parts: [{ text: currentSystemPrompt }]
        });
        // Adicionamos uma mensagem "OK" do modelo para manter a alternância user/model
        requestPayload.contents.splice(1, 0, {
            role: "model",
            parts: [{ text: "Entendido. Prosseguindo com suas instruções." }]
        });
    }


    const API_URL = fileTypeForApi === "vision" ? GEMINI_API_URL_VISION : GEMINI_API_URL_TEXT;
    if (fileTypeForApi === "vision" && API_URL.includes("gemini-pro:")) {
        displayMessage("Para enviar imagens, o modelo gemini-pro-vision é necessário. Verifique o URL da API.", "bot", "error");
        // Remover a última mensagem do usuário do histórico se ela foi apenas a imagem
        if(conversationHistory.length > 0 && conversationHistory[conversationHistory.length -1].parts.some(p => p.inline_data)){
            conversationHistory.pop();
        }
        return;
    }


    try {
        const response = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestPayload),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Erro da API:", errorData);
            let errorMessage = `Erro da API: ${response.status}`;
            if (errorData.error && errorData.error.message) {
                errorMessage += ` - ${errorData.error.message}`;
            }
            displayMessage(errorMessage, 'bot', 'error');
            // Remover a última mensagem do usuário do histórico em caso de erro para não poluir
            if(conversationHistory.length > 0 && conversationHistory[conversationHistory.length -1].role === "user"){
                 // conversationHistory.pop(); // Decidir se remove ou não
            }
            return;
        }

        const data = await response.json();
        console.log("Resposta da API:", data);

        let botResponseText = "Não foi possível obter uma resposta."; // Default
        if (data.candidates && data.candidates.length > 0) {
            const candidate = data.candidates[0];
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                // Assume que a resposta é texto por enquanto
                botResponseText = candidate.content.parts.map(part => part.text).join("\n");
            } else if (candidate.error) {
                 botResponseText = `Erro na resposta do candidato: ${candidate.error.message}`;
                 displayMessage(botResponseText, 'bot', 'error');
                 return;
            }
        } else if (data.promptFeedback && data.promptFeedback.blockReason) {
            botResponseText = `Sua solicitação foi bloqueada. Razão: ${data.promptFeedback.blockReason}.`;
            if (data.promptFeedback.blockReasonMessage) {
                 botResponseText += ` Detalhes: ${data.promptFeedback.blockReasonMessage}`;
            }
             displayMessage(botResponseText, 'bot', 'error');
             return;
        }


        displayMessage(botResponseText, 'bot');
        conversationHistory.push({ role: "model", parts: [{ text: botResponseText }] });

    } catch (error) {
        console.error("Erro ao enviar mensagem:", error);
        displayMessage(`Erro ao conectar com a API: ${error.message}`, 'bot', 'error');
    }
}

function newConversation() {
    chatArea.innerHTML = ''; // Limpa a área de chat
    conversationHistory = []; // Limpa o histórico da conversa
    // O system prompt é mantido, mas a conversa é reiniciada.
    displayMessage("Nova conversa iniciada. Como posso ajudar?", "bot");
    console.log("Nova conversa iniciada.");
}

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result); // Retorna base64 string
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

async function handleFileUpload(event) {
    const files = event.target.files;
    if (files.length === 0) {
        return;
    }
    const file = files[0];

    // Por enquanto, vamos apenas exibir a imagem e prepará-la.
    // O envio real ocorre com a mensagem.
    if (file.type.startsWith('image/')) {
        try {
            const imageBase64 = await readFileAsBase64(file);
            // Não vamos exibir a imagem aqui diretamente, ela será exibida quando a mensagem for enviada.
            // Apenas logamos que um arquivo foi selecionado.
            console.log(`Arquivo de imagem selecionado: ${file.name}`);
            // Poderia mostrar uma pequena prévia ou nome do arquivo perto do botão de upload
        } catch (error) {
            console.error("Erro ao ler arquivo para prévia:", error);
            displayMessage("Erro ao carregar imagem para prévia.", "bot", "error");
        }
    } else if (file.type.startsWith('video/')) {
        // Lógica para vídeo (pode ser mais complexo para API Gemini, que pode preferir URLs ou processamento específico)
        console.log(`Arquivo de vídeo selecionado: ${file.name}. O envio de vídeo para Gemini Vision API pode requerer formatos específicos ou upload prévio para um bucket.`);
        displayMessage("Prévia de vídeo não implementada. O envio de vídeo pode ter requisitos específicos.", "bot");
    } else {
        displayMessage("Tipo de arquivo não suportado para envio direto à API Vision.", "bot", "error");
        fileInput.value = ''; // Limpa o input se o arquivo não for suportado
    }
}


// Adiciona listener para Enter no campo de input
userInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
});

// Mensagem inicial do bot
window.onload = () => {
    loadSystemPrompt(); // Garante que o system prompt seja carregado
    displayMessage("Olá! Sou seu assistente IA. Como posso te ajudar hoje?", "bot");
    if (GEMINI_API_KEY === 'SUA_CHAVE_API_AQUI') {
         displayMessage("Lembrete: Configure sua GEMINI_API_KEY em script.js para interagir com a IA.", "bot", "error");
    }
};
