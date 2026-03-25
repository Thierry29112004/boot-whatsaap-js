const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode');

const app = express();
const porta = 3000;
let qrCodeAtual = ''; 

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', /* Esse é o mágico que salva a memória no Render */
            '--disable-gpu',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote'
        ]
    }
});

const memoriaAtendimento = {}; 

app.get('/', async (req, res) => {
    if (qrCodeAtual) {
        try {
            const qrImage = await qrcode.toDataURL(qrCodeAtual);
            res.send(`
                <html lang="pt-BR">
                    <body style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:Arial, sans-serif; background-color:#f0f2f5;">
                        <h2>Painel da Tecntel Connect 🎥🔌</h2>
                        <p>Escaneie o QR Code abaixo:</p>
                        <img src="${qrImage}" alt="QR Code" style="width:300px; height:300px; border-radius:10px; box-shadow: 0 4px 8px rgba(0,0,0,0.2);"/>
                        <script>setTimeout(() => location.reload(), 10000);</script>
                    </body>
                </html>
            `);
        } catch (err) {
            res.send('Erro ao gerar imagem.');
        }
    } else {
        res.send('<h2 style="font-family:Arial; text-align:center; margin-top:20%;">✅ Bot conectado e operando!</h2>');
    }
});

client.on('qr', qr => {
    qrCodeAtual = qr;
});

client.on('ready', () => {
    qrCodeAtual = ''; 
    console.log('✅ Bot da Tecntel Connect rodando com Anti-Áudio e Notificações Inteligentes!');
});

client.on('message', async message => {
    
    // TRAVA 1: Ignora Grupos e Status
    if (message.from === 'status@broadcast' || message.author != null || message.isGroup) return; 

    const chat = await message.getChat();
    const numeroCliente = message.from;

    // TRAVA 2: ANTI-ÁUDIO 
    if (message.type === 'ptt' || message.type === 'audio') {
        await chat.sendStateTyping();
        setTimeout(() => {
            client.sendMessage(numeroCliente, '🤖 Desculpe, como sou um assistente virtual, ainda não consigo ouvir áudios.\n\nVocê poderia digitar sua dúvida em texto, ou aguardar um instante até o técnico te atender?');
        }, 1500);
        return; // Para o código por aqui para não dar erro
    }

    // Só tenta ler o texto se tiver certeza que não é áudio
    const texto = message.body ? message.body.toLowerCase().trim() : ''; 

    const agora = new Date();
    const hora = agora.getHours();
    const diaSemana = agora.getDay(); 
    const horarioComercial = (hora >= 8 && hora < 18) && (diaSemana >= 1 && diaSemana <= 5);

    // GATILHO PRINCIPAL E OPÇÃO 0 (VOLTAR)
    if (texto.includes('orçamento') || texto.includes('cotação') || texto === 'oi' || texto === 'olá' || texto === '0' || texto === 'voltar' || texto === 'menu') {
        
        delete memoriaAtendimento[numeroCliente];

        if (!horarioComercial) {
            await chat.sendStateTyping(); 
            setTimeout(() => {
                client.sendMessage(numeroCliente, '🌙 Olá! Nosso horário de atendimento é de Seg a Sex, das 08h às 18h. Deixe sua solicitação e seremos os primeiros a te chamar no próximo dia útil!');
            }, 3000);
            return;
        }

        await chat.sendStateTyping();
        setTimeout(() => {
            const menu = 'Olá! Bem-vindo à *Tecntel Connect* 🎥🔌\n\n' +
                         'Como posso te ajudar hoje? (Digite o número da opção)\n\n' +
                         '1️⃣ - Câmeras e Alarmes\n' +
                         '2️⃣ - Redes e Wi-Fi\n' +
                         '3️⃣ - Serviços Elétricos\n' +
                         '4️⃣ - Ver fotos dos nossos serviços\n' +
                         '5️⃣ - Já sou cliente / Falar com Atendente\n' +
                         '0️⃣ - Voltar ao Menu Principal';
            client.sendMessage(numeroCliente, menu);
        }, 1500);
    }

    // RESPOSTAS DO MENU
    else if (texto === '1') {
        memoriaAtendimento[numeroCliente] = 'aguardando_detalhes'; 
        await chat.sendStateTyping();
        setTimeout(() => {
            client.sendMessage(numeroCliente, 'Ótima escolha! 🎥 Para adiantar sua cotação de *Câmeras*, me responda:\n\n- O local é Residência, Comércio ou Indústria?\n- Quantas câmeras você precisa?\n\n_(Para voltar ao início, digite *0*)_');
        }, 1500);
    } 
    else if (texto === '2') {
        memoriaAtendimento[numeroCliente] = 'aguardando_detalhes';
        await chat.sendStateTyping();
        setTimeout(() => {
            client.sendMessage(numeroCliente, 'Legal! 💻 Sobre *Redes/Wi-Fi*, me explique sua necessidade e qual o tamanho do local?\n\n_(Para voltar ao início, digite *0*)_');
        }, 1500);
    } 
    else if (texto === '3') {
        memoriaAtendimento[numeroCliente] = 'aguardando_detalhes';
        await chat.sendStateTyping();
        setTimeout(() => {
            client.sendMessage(numeroCliente, 'Certo! ⚡ Para serviços de *Elétrica*, por favor me descreva qual é o problema ou projeto da sua obra.\n\n_(Para voltar ao início, digite *0*)_');;
        }, 1500);
    } 
    else if (texto === '4') {
        await chat.sendStateTyping();
        setTimeout(async () => {
            try {
                const media = MessageMedia.fromFilePath('./foto.jpg');
                await client.sendMessage(numeroCliente, media, { caption: 'Dá uma olhada no padrão de qualidade das nossas instalações! 🚀\n\n_(Para voltar ao menu, digite *0*)_' });
            } catch (error) {
                client.sendMessage(numeroCliente, 'Ops! Estou atualizando nosso portfólio no momento.\n\n_(Para voltar ao menu, digite *0*)_');
            }
        }, 2000);
    }
    // NOVA OPÇÃO: Falar com Humano Direto
    else if (texto === '5') {
        delete memoriaAtendimento[numeroCliente];
        await chat.sendStateTyping();
        setTimeout(() => {
            client.sendMessage(numeroCliente, '👨‍🔧 Tudo bem! Já chamei um de nossos especialistas. Por favor, aguarde um instante que ele já vai te responder por aqui.\n\n_(Para voltar ao menu, digite *0*)_');
        }, 1500);
    }

    // FECHAMENTO E DEDURO DO CLIENTE
    else if (memoriaAtendimento[numeroCliente] === 'aguardando_detalhes') {
        await chat.sendStateTyping();
        setTimeout(() => {
            client.sendMessage(numeroCliente, '✅ Excelente! Muito obrigado pelas informações. \n\nUm de nossos especialistas já recebeu o seu pedido e vai entrar em contato com você por aqui em instantes para darmos andamento!');
            
            // O DEDURO: Pega a mensagem exata do cliente (message.body) e manda pra você!

            delete memoriaAtendimento[numeroCliente]; 
        }, 1500);
    }
});

client.initialize();
app.listen(porta, () => {
    console.log(`🌐 O Painel Web está rodando! Abra seu navegador em: http://localhost:${porta}`);
});