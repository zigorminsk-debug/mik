/* Глава 2. Интерфейсы, мост и VLAN */
(function () {
  const D = window.MIK_DATA;

  D.chapters.push({
    id: 'ch02', num: 2, icon: '🔌', title: 'Интерфейсы',
    summary: 'Порты, bridge, VLAN-ы и агрегирование каналов: как собрать правильную L2-схему.',
    lessons: ['l03', 'l04']
  });

  D.lessons['l03'] = {
    title: 'Интерфейсы и Bridge: правило «один интерфейс — одна подсеть»',
    lead: 'Почему в MikroTik всё ломается, когда в один bridge заведены WAN и LAN, как правильно разделить порты и чем routing отличается от bridging.',
    level: 2, time: '14 мин', tags: ['bridge', 'интерфейсы', 'ethernet'],
    video: 'assets/media/video/l03.mp4',
    videoCap: 'Видео: интерфейсы и Bridge в RouterOS',
    transcript: [
      'Главное правило, которое экономит нервы новичкам: один физический или логический интерфейс должен принадлежать только одному широковещательному домену, то есть только одной подсети. Если два интерфейса с разными адресами добавлены в один bridge, они окажутся в одном L2-сегменте и начнут конфликтовать.',
      'Смотрите, что происходит на практике. Вы создали bridge, добавили в него ether2 и ether3, повесили на bridge адрес 192.168.88.1, а на ether1 оставили адрес провайдера. Теперь ether1 и bridge — два разных интерфейса с адресами, но ether2 и ether3 в мосте. Это рабочая и самая частая схема: WAN отдельно, LAN в мосте.',
      'Есть три способа связать порты с мостом. Первый — добавить порт в bridge как порт с адресом, bridge сам владеет MAC-адресом. Второй — добавить порт без адреса, тогда он работает как обычный кабель. Третий — создать интерфейс типа bridge port, назначить ему VLAN-ы и поместить в мост. Это самый гибкий и правильный вариант для современных сетей.',
      'Проверить, что получилось, можно командой print с флагом detail. У порта, добавленного в мост, будет статус в bridge и имя master-интерфейса. Если вы видите несколько портов с одним и тем же IP — значит, схема собрана неверно.',
      'Ещё один важный момент: в bridge включён режим STP по умолчанию. Это хорошо, но он требует наличия хотя бы одного активного порта в мосте, иначе интерфейс будет в состоянии disabled. Если мост пустой, сначала добавьте порт, потом адрес, потом включите порт.',
      'И последнее: не смешивайте режимы. Либо у вас чистый routing — каждый интерфейс со своим адресом, либо чистый bridging — все порты в мосте. Попытка сделать и то и другое на одних и тех же портах почти всегда приводит к петлям и странным ARP-записям.'
    ],
    blocks: [
      { t: 'h', x: 'Три режима интерфейса' },
      { t: 'table', head: ['Тип', 'Где настраивается', 'Особенности'], rows: [
        ['Физический (ether1…ether24)', '/interface ethernet', 'Реальный порт. Есть MAC-адрес, состояние link'],
        ['Bridge port', '/interface bridge port', 'Логический порт с VLAN-ами. Добавляется в мост'],
        ['Bridge (VLAN-фильтрующий)', '/interface bridge', 'Сам мост. Есть MAC-таблица, STP, VLAN-фильтр']
      ] },
      { t: 'note', k: 'info', ttl: 'Как читать bridge port', x: 'У каждого bridge port есть два ключевых параметра: **pvid** — тег VLAN по умолчанию для нетегированного трафика, и **frame-types** — какие кадры пускать (admit-only, admit-only-untagged-and-priority-tagged, admit-all). Именно они превращают обычный мост в VLAN-фильтрующий.' },

      { t: 'h', x: 'Правильная сборка: WAN отдельно, LAN в мосте' },
      { t: 'code', ttl: 'RouterOS CLI — сборка LAN', x: '/interface bridge add name=bridge1 comment="LAN bridge"\n\n# порты LAN: без адреса, работают как кабель\n/interface bridge port add bridge=bridge1 interface=ether2\n/interface bridge port add bridge=bridge1 interface=ether3\n/interface bridge port add bridge=bridge1 interface=ether4\n\n# адрес живёт на самом мосте\n/ip address add address=192.168.88.1/24 interface=bridge1\n\n# проверка\n/interface bridge port print\n/interface bridge vlan print' },
      { t: 'code', ttl: 'RouterOS CLI — WAN', x: '# WAN-порт остаётся отдельным интерфейсом со своим адресом\n/ip address add address=203.0.113.10/30 interface=ether1\n/ip route add dst-address=0.0.0.0/0 gateway=203.0.113.9' },

      { t: 'h', x: 'Что внутри моста' },
      { t: 'ul', x: [
        '**MAC-таблица** — мост запоминает, на каком порту какой MAC, и пересылает кадры только туда.',
        '**STP** — защита от петель. При двойном подключении одного сегмента лишний порт уходит в blocking.',
        '**VLAN-фильтр** — по умолчанию выключен (`vlan-filtering=no`). Включается только после того, как все порты настроены как bridge port.',
        '**Bridge monitor** — история переключений, помогает понять, почему порт в статусе disabled.'
      ] },
      { t: 'note', k: 'danger', ttl: 'Ошибка №1 новичков', x: 'Назначить адрес 192.168.88.1 сразу на ether2 **и** на bridge1, куда добавлен ether2. Получается две копии одного адреса на одном L2-сегменте. ARP-таблица начинает «прыгать», хосты видят дубликаты IP, связь рвётся. Правило: адрес на bridge — только на bridge.' }
    ],
    steps: [
      { title: 'Осмотритесь', text: 'Посмотрите, какие порты есть, какие подняты, какие уже в мостах.', cmd: '/interface ethernet print\n/interface print detail', note: 'Флаг R (running) означает, что на порту есть линк. Флаг X — Disabled.' },
      { title: 'Создайте мост', text: 'Создайте отдельный мост для LAN, задайте фильтрацию VLAN и отключите STP на единственном мосте без риска петель.', cmd: '/interface bridge add name=bridge1 vlan-filtering=no protocol-mode=rstp', note: 'protocol-mode=rstp быстрее сходится, чем classic STP. На мосте с одним портом STP можно оставить включённым — вреда нет.' },
      { title: 'Добавьте порты в мост', text: 'LAN-порты добавляются как bridge port, без собственных адресов.', cmd: '/interface bridge port add bridge=bridge1 interface=ether2\n/interface bridge port add bridge=bridge1 interface=ether3', note: 'Если порт уже был в другом мосте, сначала удалите его оттуда: /interface bridge port remove [find interface=ether2].' },
      { title: 'Повесьте адрес на мост', text: 'Адрес локальной сети назначается на интерфейс bridge1.', cmd: '/ip address add address=192.168.88.1/24 interface=bridge1', note: 'Шлюз для клиентов = 192.168.88.1. Это и есть ваш домашний или офисный роутер.' },
      { title: 'Проверьте схему', text: 'Убедитесь, что адрес один, порты в мосте, а лишние интерфейсы не имеют чужих адресов.', cmd: '/ip address print detail\n/interface bridge port print', note: 'В выводе должен быть ровно один адрес 192.168.88.1/24 — на bridge1.' }
    ],
    pitfalls: [
      { t: 'Bridge в статусе disabled', d: 'В мост не добавлен ни один активный порт. Добавьте порт и включите его: /interface ethernet enable ether2.' },
      { t: 'Интернет пропал после настройки VLAN-фильтра', d: 'При vlan-filtering=yes все кадры, не попадающие под правила VLAN, отбрасываются. Нужно описать PVID и bridge для каждого порта, иначе трафик режется на входе.' },
      { t: 'Один и тот же MAC в двух местах', d: 'Классическая петля: один порт включён в два моста или в мост и в 802.1Q-подсеть. Ищите дубликаты в /interface bridge port print.' },
      { t: 'Порт ether1 «пропал» из bridge', d: 'На большинстве моделей ether1 — порт для первого подключения, он может быть вне моста. Если вам он нужен в LAN, добавьте его явно и проверьте, что после этого не возникнет петли с WAN-каналом.' }
    ],
    checklist: [
      'Я различаю физический порт, bridge port и сам bridge',
      'Я понимаю, что в один bridge нельзя вешать два интерфейса с разными адресами',
      'Я создал отдельный мост для LAN и повесил адрес на него',
      'Я оставил WAN-порт отдельным интерфейсом',
      'Я умею читать /interface bridge port print и /interface bridge vlan print',
      'Я понимаю, зачем нужен режим bridge port и параметр pvid'
    ],
    quiz: [
      { q: 'На каком интерфейсе должен жить адрес 192.168.88.1 в схеме с bridge LAN?', o: ['На ether2, добавленном в мост', 'На самом bridge1', 'На всех портах моста сразу', 'На ether1'], a: 1, why: 'Адрес локальной сети назначается на интерфейс bridge. Порты в мосте адресов не имеют.' },
      { q: 'Что произойдёт, если включить vlan-filtering=yes на мосте, не настроив VLAN-правила?', o: ['Ничего не изменится', 'Трафик начнёт отбрасываться на входе в порты', 'Мост выключится', 'Адрес переедет на порт'], a: 1, why: 'VLAN-фильтр по умолчанию отбрасывает всё, что не описано правилами VLAN и bridge.' },
      { q: 'Какой параметр bridge port отвечает за тег VLAN для нетегированного трафика?', o: ['pvid', 'frame-types', 'internal-path-cost', 'point-to-point'], a: 0, why: 'PVID (port VLAN ID) — VLAN, в который попадает нетегированный трафик порта.' },
      { q: 'Зачем в bridge включён STP?', o: ['Чтобы увеличить скорость', 'Чтобы защититься от петель при ошибочном подключении', 'Чтобы назначать адреса', 'Чтобы шифровать трафик'], a: 1, why: 'STP блокирует избыточное звено, если один сегмент случайно подключён к мосту дважды.' }
    ],
    cheat: [
      { g: 'Интерфейсы', c: '/interface ethernet print', d: 'Физические порты, состояние линка' },
      { g: 'Интерфейсы', c: '/interface bridge print', d: 'Список мостов и их параметры' },
      { g: 'Интерфейсы', c: '/interface bridge add name=bridge1', d: 'Создать мост' },
      { g: 'Интерфейсы', c: '/interface bridge port add bridge=bridge1 interface=ether2', d: 'Добавить порт в мост' },
      { g: 'Интерфейсы', c: '/interface bridge port print', d: 'Какие порты в каком мосте' },
      { g: 'Интерфейсы', c: '/interface bridge vlan print', d: 'Правила VLAN-фильтра моста' },
      { g: 'Интерфейсы', c: '/interface bridge monitor bridge1', d: 'Живой просмотр событий моста (остановить — Ctrl+C)' }
    ],
    summary: 'Один интерфейс — одна подсеть. Адрес LAN-подсети живёт на мосте, порты в мосте адресов не имеют, WAN — отдельный интерфейс. Для сложных схем используйте bridge port с pvid и frame-types.'
  };

  D.lessons['l04'] = {
    title: 'VLAN и Bonding: разделяем и объединяем каналы',
    lead: '802.1Q на MikroTik: single-bridge с фильтрацией или VLAN-интерфейсы на отдельном мосту. Плюс агрегирование портов в LACP и failover.',
    level: 3, time: '15 мин', tags: ['vlan', '802.1q', 'bonding', 'lacp'],
    video: 'assets/media/video/l04.mp4',
    videoCap: 'Видео: VLAN 802.1Q и bonding в RouterOS',
    transcript: [
      'VLAN-ы на MikroTik реализованы двумя принципиально разными способами, и выбор между ними определяет всю дальнейшую работу.',
      'Способ первый — фильтрующий bridge. Вы один раз включаете vlan-filtering на мосту и описываете таблицу: для каждого порта задан PVID, для каждой пары портов задан bridge, то есть разрешено ли им обмениваться трафиком конкретного VLAN. Адреса всех VLAN-ов висят на одном интерфейсе моста в виде адресов с префиксом VLAN. Это самый быстрый и гибкий способ, он используется в свежих установках.',
      'Способ второй — отдельные интерфейсы VLAN на каждом порту. Для этого каждый порт должен быть bridge port с отключённым PVID и frame-types, равным admit-only-untagged-and-priority-tagged. Тогда порт пропускает только тегированный трафик. А на отдельном, чистом мосте создаются интерфейсы vlan10, vlan20 и так далее, и уже у них берутся адреса. Этот способ медленнее, зато проще для понимания и лучше работает с аппаратным offload.',
      'Настройка выглядит так. Сначала создаём bridge с фильтрацией, добавляем порты как bridge port. Затем для каждого порта прописываем PVID — номер VLAN для нетегированного трафика. Потом в таблице bridge указываем, какие порты объединены в какой VLAN. Не забывайте добавить сам мост в каждый VLAN: без этого трафик не пройдёт.',
      'Про bonding. Это способ объединить несколько физических портов в один логический интерфейс. Режимы: 802.3ad или 802.1ax дают LACP и распределяют потоки по хэшам. Balance-alb распределяет по MAC-адресам и не требует поддержки LACP на другой стороне. Active-backup даёт просто резервный канал — основной порт работает, второй в горячем резерве.',
      'Важные детали. В bonding нельзя смешивать разные скорости, и в 802.3ad оба конца должны поддерживать LACP, иначе получите петлю и полную потерю связи. Мониторьте состояние через интерфейс monitor. И ещё: в RouterOS 7 доступен новый тип bonding — LACP с MLAG, он же bonding-lacp, где два порта на агрегированном канале работают независимо и не блокируют друг друга.'
    ],
    blocks: [
      { t: 'h', x: 'Два способа сделать VLAN' },
      { t: 'table', head: ['Способ', 'Где живут адреса', 'Когда выбирать'], rows: [
        ['Фильтрующий bridge', 'На одном интерфейсе bridge: 10.0.0.1/24, 20.0.0.1/24', 'Промышленный стандарт, быстрый, гибкий'],
        ['Отдельные vlan-интерфейсы', 'На vlan10, vlan20 в отдельном чистом мосте', 'Простота, аппаратный offload, старые схемы']
      ] },

      { t: 'h', x: 'Фильтрующий bridge: полный пример' },
      { t: 'code', ttl: 'RouterOS CLI — VLAN на одном мосту', x: '/interface bridge add name=br-lan vlan-filtering=yes protocol-mode=rstp\n\n# порты как bridge port\n/interface bridge port add bridge=br-lan interface=ether2 pvid=10 frame-types=admit-only-untagged-and-priority-tagged\n/interface bridge port add bridge=br-lan interface=ether3 pvid=20 frame-types=admit-only-untagged-and-priority-tagged\n\n# сам мост должен быть участником каждого VLAN\n/interface bridge vlan add bridge=br-lan vlan-ids=10 tagged=br-lan\n/interface bridge vlan add bridge=br-lan vlan-ids=20 tagged=br-lan\n\n# адреса на мосте\n/ip address add address=10.0.10.1/24 interface=br-lan vlan=10\n/ip address add address=10.0.20.1/24 interface=br-lan vlan=20\n\n# проверка\n/interface bridge vlan print\n/ip address print' },
      { t: 'note', k: 'warn', ttl: 'Порядок включения фильтрации', x: 'Включайте vlan-filtering только после того, как все порты переведены в bridge port и описана таблица VLAN. Иначе связь с устройством пропадёт — придётся чинить через консоль.' },

      { t: 'h', x: 'Отдельные VLAN-интерфейсы' },
      { t: 'code', ttl: 'RouterOS CLI — чистый мост + vlan-интерфейсы', x: '/interface bridge add name=br-vlan protocol-mode=rstp\n\n# порты пропускают только тегированный трафик\n/interface bridge port add bridge=br-vlan interface=ether2 pvid=none frame-types=admit-only-untagged-and-priority-tagged\n\n# vlan-интерфейсы живут в отдельном мосте\n/interface vlan add name=vlan10 interface=br-vlan vlan-id=10\n/interface vlan add name=vlan20 interface=br-vlan vlan-id=20\n\n/ip address add address=10.0.10.1/24 interface=vlan10\n/ip address add address=10.0.20.1/24 interface=vlan20' },

      { t: 'h', x: 'Bonding: объединяем порты' },
      { t: 'code', ttl: 'RouterOS CLI — LACP и failover', x: '# LACP 802.3ad: оба конца должны поддерживать LACP\n/interface bonding add name=bond1 slaves=ether2,ether3 mode=802.3ad lacp-rate=fast transmit-hash-policy=layer-2-and-3\n\n# резервный канал: основной ether2, горячий резерв ether3\n/interface bonding add name=bond2 slaves=ether2,ether3 mode=active-backup\n\n/ip address add address=10.0.0.1/24 interface=bond1\n/interface bonding monitor bond1' },
      { t: 'table', head: ['Режим', 'Что делает', 'Требования'], rows: [
        ['802.3ad / 802.1ax (LACP)', 'Балансировка по хэшу, агрегация скоростей', 'LACP с обеих сторон'],
        ['balance-xor', 'Балансировка по MAC', 'Обычный Ethernet'],
        ['balance-rr', 'Round-robin по пакетам', 'Обычный Ethernet, не любит TCP'],
        ['active-backup', 'Резервный канал, без балансировки', 'Ничего, самое простое']
      ] },
      { t: 'note', k: 'danger', ttl: 'Главная ошибка bonding', x: 'Один порт входит в два агрегата, или две машины соединены портами, включёнными в разные агрегаты, — это петля. LACP спасает от этого: агрегация поднимается только когда оба конца согласовали порты.' }
    ],
    steps: [
      { title: 'Спроектируйте таблицу VLAN', text: 'Запишите: номер VLAN, какие порты в нём, тегированный или нет, где живёт адрес.', cmd: 'VLAN 10 — management (ether2, native)\nVLAN 20 — clients (ether3, native)\nVLAN 30 — trunk к другому коммутатору', note: 'Рисунок схемы на бумаге экономит час отладки.' },
      { title: 'Включите фильтрацию VLAN', text: 'Создайте или возьмите существующий мост и включите на нём VLAN-фильтрацию.', cmd: '/interface bridge set br-lan vlan-filtering=yes', note: 'Сразу после этого связь может пропасть — дальше настраиваем порты и правила VLAN.' },
      { title: 'Опишите порты', text: 'Каждый порт должен стать bridge port с нужным PVID.', cmd: '/interface bridge port add bridge=br-lan interface=ether2 pvid=10\n/interface bridge port set [find interface=ether3] pvid=20', note: 'Для trunk-портов pvid=none и frame-types=admit-only-untagged-and-priority-tagged.' },
      { title: 'Задайте таблицу bridge', text: 'Укажите, какие порты объединены в какой VLAN, и не забудьте про сам мост.', cmd: '/interface bridge vlan add bridge=br-lan vlan-ids=10 tagged=br-lan\n/interface bridge vlan add bridge=br-lan vlan-ids=20 tagged=br-lan', note: 'Без строки с tagged=br-lan мост не участвует в обмене и трафик не поднимется.' },
      { title: 'Назначьте адреса и проверьте', text: 'Адреса висят на мосте с указанием VLAN.', cmd: '/ip address add address=10.0.10.1/24 interface=br-lan vlan=10\n/interface bridge vlan print', note: 'В выводе должно быть видно, что порт ether2 принадлежит VLAN 10, ether3 — VLAN 20.' },
      { title: 'Добавьте bonding при необходимости', text: 'Создайте агрегат и дайте ему адрес.', cmd: '/interface bonding add name=bond1 slaves=ether2,ether3 mode=802.3ad\n/ip address add address=10.0.30.1/24 interface=bond1', note: 'Если на другой стороне нет LACP — используйте active-backup, это безопаснее.' }
    ],
    pitfalls: [
      { t: 'После vlan-filtering=yes пропала связь', d: 'Порты не переведены в bridge port или в таблице VLAN нет самого моста. Подключитесь консолью, проверьте /interface bridge vlan print и /interface bridge port print.' },
      { t: 'Трафик VLAN не течёт, обычный течёт', d: 'Проверьте PVID портов и frame-types. Нетегированный трафик должен попадать в VLAN, равный PVID порта.' },
      { t: 'Bonding поднялся, но скорость не выросла', d: 'Значит, трафик идёт по одному потоку (хэш по 5-tuple), либо второй порт не в LACP-группе. Смотрите /interface bonding monitor и счётчики по портам.' },
      { t: 'Bonding работает через раз', d: 'Разные скорости портов или несовпадение настроек LACP на второй стороне. Синхронизируйте скорость, дуплекс и режим агрегации на обоих концах.' }
    ],
    checklist: [
      'Я знаю разницу между фильтрующим bridge и отдельными vlan-интерфейсами',
      'Я умею задавать pvid и frame-types для порта',
      'Я понимаю, зачем в таблице VLAN указывать сам мост',
      'Я создал bonding в режиме 802.3ad или active-backup',
      'Я умею смотреть состояние агрегата через monitor',
      'Я проверяю связность после каждого шага, а не в конце'
    ],
    quiz: [
      { q: 'Что означает pvid у bridge port?', o: ['Приоритет в STP', 'VLAN для нетегированного трафика порта', 'MAC-адрес порта', 'Пароль порта'], a: 1, why: 'PVID = Port VLAN ID: в какой VLAN попадает нетегированный трафик с этого порта.' },
      { q: 'Какой режим bonding даёт простой резервный канал без балансировки?', o: ['802.3ad', 'balance-rr', 'active-backup', 'balance-alb'], a: 2, why: 'active-backup: один порт работает, второй в горячем резерве, переключение при обрыве.' },
      { q: 'Что произойдёт, если в LACP-агрегате один конец не поддерживает 802.3ad?', o: ['Канал всё равно соберётся', 'Связь по агрегату не поднимется, чтобы избежать петли', 'Порты перейдут в active-backup', 'Упадёт весь интернет'], a: 1, why: 'LACP специально спроектирован так, чтобы агрегация поднималась только при согласовании обоих концов.' },
      { q: 'Где указывается адрес VLAN 20 в фильтрующем bridge?', o: ['На порту с VLAN 20', 'На интерфейсе моста с указанием vlan=20', 'На отдельном интерфейсе vlan20', 'Везде, где удобно'], a: 1, why: 'В фильтрующем bridge адреса висят на самом интерфейсе моста с параметром vlan.' },
      { q: 'Что означает frame-types=admit-only-untagged-and-priority-tagged?', o: ['Пропускать только нетегированные кадры', 'Пропускать нетегированные кадры и кадры с тегом приоритета', 'Пропускать всё подряд', 'Отбрасывать тегированные кадры'], a: 1, why: 'Этот режим пропускает обычный трафик и 802.1p-приоритет, но отбрасывает кадры с VLAN-тегом.' }
    ],
    cheat: [
      { g: 'VLAN', c: '/interface bridge vlan add bridge=br-lan vlan-ids=10 tagged=br-lan', d: 'Добавить VLAN в таблицу моста' },
      { g: 'VLAN', c: '/interface bridge port set [find interface=ether2] pvid=10', d: 'Задать PVID порту' },
      { g: 'VLAN', c: '/interface vlan add name=vlan10 interface=br-lan vlan-id=10', d: 'Создать отдельный vlan-интерфейс' },
      { g: 'VLAN', c: '/interface bridge vlan print', d: 'Показать таблицу VLAN моста' },
      { g: 'Bonding', c: '/interface bonding add name=bond1 slaves=ether2,ether3 mode=802.3ad', d: 'Создать LACP-агрегат' },
      { g: 'Bonding', c: '/interface bonding monitor bond1', d: 'Состояние и счётчики агрегата' },
      { g: 'Bonding', c: '/interface bonding print', d: 'Список агрегатов и их slave-портов' }
    ],
    summary: 'VLAN на MikroTik: либо фильтрующий bridge с pvid и таблицей bridge, либо отдельные vlan-интерфейсы на чистом мосте. Bonding: 802.3ad для скорости (LACP с двух сторон), active-backup для простого резерва.'
  };
})();
