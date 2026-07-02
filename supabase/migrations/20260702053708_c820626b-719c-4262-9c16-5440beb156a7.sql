UPDATE public.tenant_whatsapp_config SET
  mensagem_novo_palpite = '⚽ Olá! Quero participar do *{{nome_bolao}}* 🏆

👤 Nome: {{nome_torcedor}}
📱 WhatsApp: {{whatsapp_torcedor}}

🆚 Jogo: {{bandeira_a}} {{selecao_a}} x {{selecao_b}} {{bandeira_b}}
🎯 Palpite: *{{palpite_a}} x {{palpite_b}}*
💰 Valor: *R$ {{valor_palpite}}*

💳 Já vou fazer o Pix e envio o comprovante por aqui. 🙌🍀',
  mensagem_confirmacao_pagamento = '🎉 Olá, {{nome_torcedor}}!

✅ Seu palpite foi *confirmado* no *{{nome_bolao}}* 🏆

🆚 Jogo: {{bandeira_a}} {{selecao_a}} x {{selecao_b}} {{bandeira_b}}
🎯 Seu palpite: *{{palpite_a}} x {{palpite_b}}*
💵 Valor: R$ {{valor_palpite}}
📌 Status: *Pago ✅*

Boa sorte! 🍀⚽',
  mensagem_ganhador = '🏆🎉 PARABÉNS, {{nome_torcedor}}! 🎉🏆

⚽ Você *acertou o placar* do jogo:
{{bandeira_a}} {{selecao_a}} *{{placar_a}} x {{placar_b}}* {{selecao_b}} {{bandeira_b}}

🎯 Seu palpite: *{{palpite_a}} x {{palpite_b}}*

💰 Você está na lista de *ganhadores* do *{{nome_bolao}}*.
📞 Em breve entramos em contato para o prêmio. 🥇',
  mensagem_lembrete_pagamento = '⏰ Olá, {{nome_torcedor}}!

Seu palpite no *{{nome_bolao}}* ainda está *pendente de pagamento* 💳

🏦 Pix para: *{{nome_recebedor}}*
🔑 Chave: `{{chave_pix}}`
🏛️ Banco: {{banco}}

📎 Envie o comprovante por aqui para confirmarmos. 🙌⚽',
  updated_at = now();