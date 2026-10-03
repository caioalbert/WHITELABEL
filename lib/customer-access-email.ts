export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

export function buildCustomerAccessEmail(input: { nome: string; password: string; documentLabel?: 'CPF' | 'CNPJ'; reset?: boolean; preview?: boolean }) {
  const name = escapeEmailHtml(input.nome.trim())
  const password = escapeEmailHtml(input.password)
  const documentLabel = input.documentLabel || 'CPF'
  const title = input.reset ? 'Vamos renovar seu acesso' : 'Seu primeiro acesso começa aqui'
  const subject = `${input.preview ? '[Prévia] ' : ''}${input.reset ? 'Redefina sua senha' : 'Seu primeiro acesso'} — Nova Aliança Saúde`
  const text = `${input.preview ? 'PRÉVIA COM DADOS FICTÍCIOS. NÃO É UMA SENHA REAL.\n\n' : ''}Olá, ${input.nome.trim()}.\n\nSua senha ${input.reset ? 'temporária de recuperação' : 'inicial temporária'} é ${input.password}.\n\nAcesse https://novaaliancasaude.com.br/login e informe seu ${documentLabel} cadastrado e essa senha. Em seguida, você deverá criar sua senha pessoal para continuar. Nos próximos acessos, use seu ${documentLabel} e a senha que você criou.\n\nA senha temporária não tem prazo de expiração e é invalidada no primeiro uso. Se o contato for da empresa, encaminhe somente ao cliente identificado nesta mensagem. Se não solicitou o acesso, procure o suporte.\n\nEquipe Nova Aliança Saúde\nsuporte@novaaliancasaude.com.br`
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f3f6fa;color:#172b46;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${input.preview ? 'Prévia com dados fictícios. ' : ''}Seu acesso à Nova Aliança Saúde, com segurança e cuidado.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fa;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;">
<tr><td style="padding:0 8px 20px;font-size:15px;font-weight:700;letter-spacing:.2px;color:#16416f;">Nova Aliança Saúde</td></tr>
${input.preview ? '<tr><td style="padding:12px 16px;border:1px solid #e9d6a7;border-radius:12px;background:#fff9ec;color:#76520a;font-size:12px;line-height:18px;">PRÉVIA COM DADOS FICTÍCIOS · Esta mensagem não concede acesso a uma conta.</td></tr><tr><td height="16"></td></tr>' : ''}
<tr><td style="background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:32px 28px 12px;font-size:12px;font-weight:700;letter-spacing:1.4px;color:#47709b;">${input.reset ? 'RECUPERAÇÃO DE ACESSO' : 'BOAS-VINDAS'}</td></tr>
<tr><td style="padding:0 28px 18px;font-size:29px;font-weight:700;line-height:35px;letter-spacing:-.6px;">${title}</td></tr>
<tr><td style="padding:0 28px 8px;font-size:17px;line-height:26px;">Olá, <strong>${name}</strong>.</td></tr>
<tr><td style="padding:0 28px 24px;font-size:15px;line-height:24px;color:#54657a;">${input.reset ? 'Use a senha temporária abaixo para criar uma nova senha pessoal.' : 'Preparamos seu acesso. Use a senha inicial abaixo e crie sua senha pessoal no primeiro acesso.'}</td></tr>
<tr><td style="padding:0 28px 24px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef4fb;border:1px solid #d8e4f2;border-radius:14px;"><tr><td align="center" style="padding:20px 12px 8px;font-size:12px;color:#486686;">SENHA ${input.reset ? 'TEMPORÁRIA' : 'INICIAL TEMPORÁRIA'}</td></tr><tr><td align="center" style="padding:0 12px 12px;font-family:Consolas,'Courier New',monospace;font-size:22px;font-weight:700;letter-spacing:1px;color:#173f70;word-break:break-all;">${password}</td></tr><tr><td align="center" style="padding:0 12px 20px;font-size:12px;color:#647990;">Válida até o primeiro uso</td></tr></table></td></tr>
<tr><td style="padding:0 28px 12px;font-size:15px;font-weight:700;">Como entrar</td></tr>
<tr><td style="padding:0 28px 24px;font-size:14px;line-height:26px;color:#54657a;">1. Informe seu <strong style="color:#172b46;">${documentLabel} cadastrado</strong> na tela de acesso.<br>2. Digite a <strong style="color:#172b46;">senha inicial deste e-mail</strong>.<br>3. Crie sua <strong style="color:#172b46;">senha pessoal</strong> para continuar.</td></tr>
<tr><td style="padding:0 28px 24px;"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#173f70" style="border-radius:10px;"><a href="https://novaaliancasaude.com.br/login" style="display:inline-block;padding:14px 24px;font-size:14px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;">Acessar minha conta&nbsp; →</a></td></tr></table></td></tr>
<tr><td style="padding:0 28px 28px;font-size:13px;line-height:21px;color:#697a8e;">Nos próximos acessos, use seu ${documentLabel} e a senha que você criou.<br>Se este é o contato da empresa, encaminhe a mensagem somente ao cliente identificado acima.</td></tr>
<tr><td style="padding:0 28px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="border-top:1px solid #e8edf3;height:1px;"></td></tr></table></td></tr>
<tr><td style="padding:20px 28px 24px;font-size:13px;line-height:21px;color:#697a8e;"><img src="https://novaaliancasaude.com.br/logo-nova-alianca-azul.png" width="90" height="90" alt="Nova Aliança Saúde" style="display:block;border:0;margin-bottom:10px;"><strong style="color:#172b46;font-size:14px;">Equipe Nova Aliança Saúde</strong><br>Seu cuidado, mais perto.<br><a href="mailto:suporte@novaaliancasaude.com.br" style="color:#173f70;text-decoration:none;word-break:break-all;">suporte@novaaliancasaude.com.br</a></td></tr>
</table></td></tr>
<tr><td align="center" style="padding:20px 12px 0;font-size:11px;line-height:18px;color:#7c8999;">Nunca envie sua senha pessoal ao suporte.<br>${input.preview ? 'Nome e senha apresentados são fictícios; o fluxo de senha está em implementação.' : 'Se não solicitou este acesso, entre em contato com nossa equipe.'}</td></tr>
</table></td></tr></table></body></html>`
  return { subject, html, text }
}
