const { Client, RemoteAuth, MessageMedia } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const express = require('express');
const qrcode = require('qrcode');

// Configurações do Painel e Banco de Dados
const app = express();
const porta = process.env.PORT || 3000;

// O NOSSO NOVO SEMÁFORO 🚦
let statusBot = 'iniciando'; 
let qrCodeAtual = ''; 

const memoriaAtendimento = {};
const MONGODB_URI = process.env.MONGODB_URI;

// 🌐 ROTA DO PAINEL WEB (Agora com 3 estágios)
app.get('/', async (req, res) => {
    if (statusBot === 'iniciando') {
        res.send(`
            <html lang="pt-BR">
                <body style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:Arial, sans-serif; background-color:#f0f2f5; text-align:center;">
                    <h2>⏳ O robô está acordando...</h2>
                    <p>O Google Chrome invisível está sendo aberto e conectando ao Banco de Dados.</p>
                    <p>Isso pode levar de 15 a 30 segundos. A página vai atualizar sozinha!</p>
                    <script>setTimeout(() => location.reload(), 5000);</script>
                </body>
            </html>
        `);
    } else if (statusBot === 'qr_code' && qrCodeAtual) {
        try {
            const qrImage = await qrcode.toDataURL(qrCodeAtual);
            res.send(`
                <html lang="pt-BR">
                    <body style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:Arial, sans-serif; background-color:#f0f2f5;">
                        <h2>Painel da Tecntel Connect 🎥🔌</h2>
                        <p>Escaneie o QR Code abaixo com seu WhatsApp:</p>
                        <img src="${qrImage}" alt="QR Code" style="width:300px; height:300px; border-radius:10px; box-shadow: 0 4px 8px rgba(0,0,0,0.2);"/>
                        <p style="color: red; font-size: 14px; margin-top: 10px;">Seja rápido! O código expira em 40 segundos.</p>
                        <script>setTimeout(() => location.reload(), 10000);</script>
                    </body>
                </html>
            `);
        } catch (err) {
            res.send('Erro ao gerar imagem.');
        }
    } else if (statusBot === 'conectado') {
        res.send(`
            <html lang="pt-BR">
                <body style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:Arial, sans-serif; background-color:#e6f4ea;">
                    <h2 style="color: #137333;">✅ Bot conectado e operando!</h2>
                    <p>O seu login está salvo no Banco de Dados. Pode fechar esta página.</p>
                </body>
            </html>
        `);
    }
});

// 💾 LIGAÇÃO AO BANCO DE DADOS E CRIAÇÃO DO ROBÔ
mongoose.connect(MONGODB_URI).then(() => {
    console.log('✅ Banco de Dados ligado com sucesso!');
    
    const store = new MongoStore({ mongoose: mongoose });

    const client = new Client({
        authStrategy: new RemoteAuth({
            store: store,
            backupSyncIntervalMs: 300000 
        }),
        puppeteer: {
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote'
            ]
        }
    });

    // 📱 EVENTOS DO WHATSAPP (Atualizando o semáforo)
    client.on('qr', qr => {
        statusBot = 'qr_code'; // Muda o status para mostrar a tela do QR Code
        qrCodeAtual = qr;
        console.log('⚠️ Novo QR Code gerado! Atualize a página web.');
    });

    client.on('ready', () => {
        statusBot = 'conectado'; // Muda o status para a tela de Sucesso
        qrCodeAtual = ''; 
        console.log('✅ Bot da Tecntel Connect rodando com Sucesso!');
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
            return; 
        }

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
                client.sendMessage(numeroCliente, 'Certo! ⚡ Para serviços de *Elétrica*, por favor me descreva qual é o problema ou projeto da sua obra.\n\n_(Para voltar ao início, digite *0*)_');
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
        else if (texto === '5') {
            delete memoriaAtendimento[numeroCliente];
            await chat.sendStateTyping();
            setTimeout(() => {
                client.sendMessage(numeroCliente, '👨‍🔧 Tudo bem! Já chamei um de nossos especialistas. Por favor, aguarde um instante que ele já vai te responder por aqui.\n\n_(Para voltar ao menu, digite *0*)_');
            }, 1500);
        }

        // FECHAMENTO
        else if (memoriaAtendimento[numeroCliente] === 'aguardando_detalhes') {
            await chat.sendStateTyping();
            setTimeout(() => {
                client.sendMessage(numeroCliente, '✅ Excelente! Muito obrigado pelas informações. \n\nUm de nossos especialistas já recebeu o seu pedido e vai entrar em contato com você por aqui em instantes para darmos andamento!');
                delete memoriaAtendimento[numeroCliente]; 
            }, 1500);
        }
    });

    client.initialize();

}).catch((err) => {
    console.error('❌ Erro ao ligar ao MongoDB: ', err);
});

// Liga o servidor Web
app.listen(porta, () => {
    console.log(`🌐 O Painel Web está rodando na porta ${porta}`);
});