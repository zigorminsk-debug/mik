/* Глава 6. Firewall: фильтрация, маркировка и защита */
(function () {
  const D = window.MIK_DATA;

  D.chapters.push({
    id: 'ch06', num: 6, icon: '🛡️', title: 'Firewall',
    summary: 'Цепочки filter, mangle, raw и nat: как построить понятную и безопасную политику доступа.',
    lessons: ['l11', 'l12']
  });

  D.lessons['l11'] = {
    title: 'Firewall: цепочки, порядок правил и базовая политика',
    lead: 'Как устроен фильтр RouterOS, почему порядок правил решает всё и как написать рабочую политику доступа за 10 минут.',
    level: 4, time: '17 мин', tags: ['firewall', 'filter', 'security'],
    video: 'assets/media/video/l11.mp4',
    videoCap: 'Видео с субтитрами: цепочки firewall и порядок правил',
    transcript: [
      'Firewall в RouterOS состоит из нескольких таблиц, и главная из них — filter. У неё есть цепочки, и пакет проходит через них по порядку. Это не список правил, это этапы обработки.',
      'Цепочка input — трафик, предназначенный самому роутеру. Сюда попадает ping с компьютера, обращение к winbox и ssh, DHCP-запросы клиентов. Эту цепочку обычно закрывают жёстко.',
      'Цепочка forward — трафик, идущий через роутер. Сюда попадает интернет для клиентов, ответы на ваши исходящие соединения, входящие подключения к проброшенным портам и трафик между VLAN-ами.',
      'Цепочка output — трафик, который генерирует сам роутер: пинги, обновления, запросы DNS. По умолчанию она открыта, и это нормально, но при особо строгих требованиях её тоже ограничивают.',
      'Порядок правил имеет прямое значение: правила выполняются сверху вниз, и первое подошедшее правило решает судьбу пакета. Поэтому шаблон всегда один: сначала accept для established-соединений, потом правила для нужного направления, а в самом конце drop всего остального.',
      'Ключевая деталь — connection tracking. Роутер запоминает каждое исходящее соединение и все ответные пакеты. Поэтому правило accept для established,established пропускает обратный трафик автоматически, и вам не нужно писать обратные правила для каждого сервиса.',
      'Ещё один важный приём — адрес-листы. Вместо того чтобы создавать отдельное правило для каждого заблокированного адреса, вы собираете их в список и ссылаетесь на список в правиле. Так список можно пополнять скриптом или вручную, а политика остаётся читаемой.'
    ],
    blocks: [
      { t: 'h', x: 'Четыре таблицы firewall' },
      { t: 'table', head: ['Таблица', 'Что делает', 'Когда трогать'], rows: [
        ['filter', 'Разрешает или отбрасывает пакеты', 'Всегда, это основа политики'],
        ['nat', 'Подменяет адреса и порты', 'Нужен для выхода в интернет и пробросов'],
        ['mangle', 'Маркирует пакеты, меняет TTL, DSCP', 'QoS, policy routing, перехват traffic'],
        ['raw', 'Работает до conntrack, не пишет состояние', 'Быстрый drop, обход трекинга, mangle для маркировок']
      ] },
      { t: 'note', k: 'info', ttl: 'Порядок обработки пакета', x: 'Сначала **raw** (до подсчёта соединений), затем **mangle** на цепочке prerouting, потом **conntrack** и **filter**, потом **mangle** на output, потом **filter** в output. NAT применяется на цепочках srcnat и dstnat в нужный момент.' },

      { t: 'h', x: 'Три цепочки filter' },
      { t: 'table', head: ['Цепочка', 'Трафик', 'Типичная политика'], rows: [
        ['input', 'К самому роутеру', 'Открыть только управление с управляющей подсети'],
        ['forward', 'Через роутер', 'Разрешить LAN → WAN, запретить WAN → LAN'],
        ['output', 'От самого роутера', 'Обычно разрешено всё']
      ] },

      { t: 'h', x: 'Шаблон базовой политики' },
      { t: 'code', ttl: 'RouterOS CLI — рабочая база', x: '# 1. Защита самого роутера\n/ip firewall filter add chain=input connection-state=established,related action=accept comment="accept established"\n/ip firewall filter add chain=input connection-state=invalid action=drop comment="drop invalid"\n/ip firewall filter add chain=input protocol=icmp action=accept comment="allow ping"\n/ip firewall filter add chain=input in-interface=bridge1 action=accept comment="allow from LAN"\n/ip firewall filter add chain=input action=drop comment="drop everything else"\n\n# 2. Транзитный трафик\n/ip firewall filter add chain=forward connection-state=established,related action=accept comment="accept established"\n/ip firewall filter add chain=forward connection-state=invalid action=drop comment="drop invalid"\n/ip firewall filter add chain=forward connection-state=new out-interface=ether1 action=accept comment="LAN to WAN"\n/ip firewall filter add chain=forward action=drop comment="drop all other forward"' },
      { t: 'note', k: 'danger', ttl: 'Главное правило firewall', x: 'Последнее правило в цепочке — drop всего остального. Без него цепочка по умолчанию разрешает всё, и ваш firewall ничего не делает. Проверьте: `/ip firewall filter print` — последнее правило должно быть action=drop.' },
      { t: 'note', k: 'tip', ttl: 'Не спешите с drop', x: 'Сначала соберите правила с action=accept и добавьте счётчики. Посмотрите, что реально проходит: `/ip firewall filter print stats`. Только потом добавляйте финальный drop.' },

      { t: 'h', x: 'Address-list' },
      { t: 'code', ttl: 'RouterOS CLI — списки адресов', x: '/ip firewall address-list add list=trusted address=192.168.88.0/24\n/ip firewall address-list add list=blocked address=203.0.113.66\n\n# правило со ссылкой на список\n/ip firewall filter add chain=input src-address-list=blocked action=drop comment="block list"\n/ip firewall filter add chain=input src-address-list=trusted action=accept\n\n# список меняется без правки правил\n/ip firewall address-list add list=blocked address=198.51.100.0/24\n/ip firewall address-list print', note: 'Динамические списки можно пополнять из логов: /ip firewall filter add chain=input log=yes log-prefix=DROP ...' }
    ],
    steps: [
      { title: 'Сделайте бэкап перед началом', text: 'Правила фильтрации легко испортить, а доступ потерять — ещё проще.', cmd: '/system backup save name=before-firewall', note: 'Восстановление: /system backup load name=before-firewall (устройство перезагрузится).' },
      { title: 'Опишите зоны', text: 'Решите, какие интерфейсы считаются доверенными, какие — публичными.', cmd: 'bridge1 = LAN (доверенная)\nether1 = WAN (публичная)', note: 'Опишите зоны комментариями в правилах — через полгода вы будете благодарны.' },
      { title: 'Закройте input', text: 'Разрешите управление только из LAN, остальное — drop.', cmd: '/ip firewall filter add chain=input connection-state=established,related action=accept\n/ip firewall filter add chain=input in-interface=bridge1 action=accept\n/ip firewall filter add chain=input action=drop', note: 'Проверяйте себя: после добавления последнего правила Winbox по-прежнему доступен с LAN?' },
      { title: 'Настройте forward', text: 'established → new в интернет → drop.', cmd: '/ip firewall filter add chain=forward connection-state=established,related action=accept\n/ip firewall filter add chain=forward connection-state=new out-interface=ether1 action=accept\n/ip firewall filter add chain=forward action=drop', note: 'Не забудьте правила для доступа между VLAN-ми, если они нужны.' },
      { title: 'Проверьте счётчики', text: 'Смотрите, что реально проходит и что отбрасывается.', cmd: '/ip firewall filter print stats', note: 'Нулевые счётчики у нужных правил — повод разобраться. Большие счётчики у drop — повод понять, кто ломится.' }
    ],
    pitfalls: [
      { t: 'Потеряли доступ к роутеру', d: 'Физический доступ + консоль, либо восстановление бэкапа: /system backup load. Всегда держите кабель для serial.' },
      { t: 'Интернет пропал после настройки filter', d: 'Обычно забыт accept для established или new в цепочке forward. Проверьте порядок правил и счётчики.' },
      { t: 'Drop-правило не срабатывает', d: 'Правила выполняются сверху вниз. Если выше стоит accept с широкими условиями, до drop пакет не дойдёт.' },
      { t: 'Фильтр ничего не блокирует', d: 'Возможно, в таблице filter нет ни одного drop в конце, либо трафик идёт через fasttrack и минует часть проверок.' },
      { t: 'Ping перестал проходить после включения правил', d: 'Нужно отдельное правило accept для protocol=icmp, если вы его не добавили.' }
    ],
    checklist: [
      'Я знаю назначение цепочек input, forward и output',
      'Я понимаю, что правила выполняются по порядку',
      'Я всегда закрываю цепочку финальным drop',
      'Я использую connection-state=established,related',
      'Я применяю address-list вместо hundreds правил',
      'Я умею читать счётчики правил и понимаю, что они значат'
    ],
    quiz: [
      { q: 'В какой цепочке обрабатывается трафик, идущий через роутер к серверу в интернете?', o: ['input', 'forward', 'output', 'prerouting'], a: 1, why: 'forward — транзитный трафик между интерфейсами.' },
      { q: 'Что делает правило connection-state=established,related?', o: ['Разрешает все пакеты', 'Разрешает обратный трафик по уже установленным соединениям', 'Запрещает входящие', 'Отключает трекинг'], a: 1, why: 'Это базовое правило, которое избавляет от написания обратных правил.' },
      { q: 'Почему порядок правил важен?', o: ['RouterOS сортирует их сам', 'Пакет обрабатывается первым подошедшим правилом, дальше не идёт', 'Порядок влияет только на скорость', 'Не влияет'], a: 1, why: 'Как только правило сработало (accept или drop), обработка цепочки прекращается.' },
      { q: 'Зачем нужен финальный drop?', o: ['Чтобы ускорить обработку', 'Чтобы цепочка по умолчанию не разрешала всё подряд', 'Чтобы писать логи', 'Чтобы работал FastPath'], a: 1, why: 'Без него политика «закрыто по умолчанию» не работает и firewall пропускает всё.' },
      { q: 'Что такое address-list?', o: ['Список MAC-адресов', 'Именованный список IP-адресов, на который ссылаются правила', 'Таблица маршрутов', 'Очередь'], a: 1, why: 'Позволяет менять состав заблокированных или доверенных адресов, не переписывая правила.' }
    ],
    cheat: [
      { g: 'Firewall', c: '/ip firewall filter add chain=input in-interface=bridge1 action=accept', d: 'Разрешить доступ из LAN' },
      { g: 'Firewall', c: '/ip firewall filter add chain=forward connection-state=established,related action=accept', d: 'Разрешить обратный трафик' },
      { g: 'Firewall', c: '/ip firewall filter add chain=forward action=drop', d: 'Финальный запрет' },
      { g: 'Firewall', c: '/ip firewall filter print stats', d: 'Правила со счётчиками' },
      { g: 'Firewall', c: '/ip firewall address-list add list=blocked address=1.2.3.4', d: 'Добавить адрес в список' },
      { g: 'Firewall', c: '/ip firewall address-list print', d: 'Содержимое списков' },
      { g: 'Firewall', c: '/ip firewall filter remove [find chain=forward]', d: 'Удалить правила цепочки' }
    ],
    summary: 'input — к роутеру, forward — через него, output — от него. Правила идут сверху вниз, первое подошедшее решает. Базовая политика: established → нужные accept → drop в конце. Address-list вместо тысячи правил.'
  };

  D.lessons['l12'] = {
    title: 'Mangle, Raw и защита от атак: продвинутые приёмы',
    lead: 'Маркировка трафика, обход conntrack, ограничение скорости входящих подключений, layer7 и типовые защиты.',
    level: 5, time: '16 мин', tags: ['mangle', 'raw', 'ddos', 'layer7'],
    video: 'assets/media/video/l12.mp4',
    videoCap: 'Видео с субтитрами: mangle, raw и защита от DoS',
    transcript: [
      'Mangle — это таблица для манипуляций с пакетами, которые не умеет filter. Здесь ставят метки для очередей, меняют TTL, задают DSCP для QoS и управляют policy routing.',
      'Самый частый сценарий в mangle — маркировка трафика по адресу источника или по порту. Гостевая сеть получает метку guest, и дальше simple queues распределяют её полосу отдельно от рабочей.',
      'Ещё один приём — маркировка connection mark. Он позволяет пометить целое соединение, чтобы потом применять к нему правила в filter или NAT. Это удобно, когда нужно различать трафик по признаку, который виден только на первом пакете.',
      'Таблица raw стоит выше всех и работает до подсчёта соединений. Это даёт две возможности. Первая — быстрый drop нежелательного трафика без нагрузки на conntrack. Вторая — маркировка пакетов, которые нужно пропустить через mangle без учёта состояния, например для policy routing.',
      'Для защиты от DoS есть специальные механизмы. Ограничение числа соединений на адрес: если клиент открывает тысячи соединений, он забанен. Ограничение частоты пакетов: syn flood отсекается. Это встроенные средства, и они работают лучше, чем самописные правила.',
      'Layer7-фильтрация позволяет смотреть внутрь протокола: регулярные выражения по HTTP-заголовкам, редиректы на другой порт, ограничение скорости соединений. Powerful, но тяжёлый: каждое правило нагружает процессор, поэтому применяйте его точечно.',
      'И последнее: не забывайте raw в схемах с hairpin и policy routing. Маркировка для policy routing должна применяться до принятия решения о маршрутизации, а соединения, которые вы маркируете, должны участвовать в conntrack. Поэтому action=mark-routing ставится в raw, а не в mangle.'
    ],
    blocks: [
      { t: 'h', x: 'Mangle: что умеет' },
      { t: 'ul', x: [
        '**mark-routing** — метка для policy routing.',
        '**mark-packet / mark-connection** — метки для очередей и правил.',
        '**set-ttl** — управление «временем жизни» пакета, защита от петель.',
        '**set-dscp** — приоритет для QoS у провайдера.',
        '**change-mss / change-dscp** — тюнинг TCP MSS для туннелей.'
      ] },
      { t: 'code', ttl: 'RouterOS CLI — маркировка', x: '# метка пакета для очередей\n/ip firewall mangle add chain=prerouting src-address=192.168.90.0/24 action=mark-packet new-packet-mark=guest-pkt\n\n# метка соединения\n/ip firewall mangle add chain=prerouting src-address=192.168.90.0/24 action=mark-connection new-connection-mark=guest-conn\n\n# для policy routing маркировка делается в raw, до conntrack\n/ip firewall raw add chain=prerouting src-address=192.168.90.0/24 action=mark-routing new-routing-mark=guest', note: 'Ошибка номер один: mark-routing в таблице mangle не сработает для маршрутизации. Для этого используют raw.' },
      { t: 'note', k: 'info', ttl: 'Mangle или raw — mark-routing', x: 'RouterOS применяет маркировку маршрутизации только на цепочке prerouting таблицы raw. В mangle она просто игнорируется. Это частая причина, почему policy routing «не работает».' },

      { t: 'h', x: 'Raw: до подсчёта соединений' },
      { t: 'code', ttl: 'RouterOS CLI — быстрый drop и защита', x: '# блокируем мультикаст, который не нужен\n/ip firewall raw add chain=prerouting action=drop src-address=224.0.0.0/4 protocol=udp comment="no multicast"\n\n# ограничение числа соединений с одного адреса (защита от DoS)\n/ip firewall filter add chain=input protocol=tcp connection-limit=25,20,10,5 src-address-list=trusted comment="limit per-host"\n\n# защита от syn-flood: ограничение частоты новых соединений\n/ip firewall filter add chain=forward protocol=tcp connection-rate=100,10 src-address-list=trusted action=drop comment="syn flood"\n\n# классический DDoS-фильтр провайдера\n/ip firewall filter add chain=forward protocol=udp dst-port=123 action=drop src-address-list=ddos-src comment="ntp amp"' },

      { t: 'h', x: 'Layer7 и редирект' },
      { t: 'code', ttl: 'RouterOS CLI — примеры layer7', x: '# редирект на локальный веб-сервер\n/ip firewall nat add chain=dstnat protocol=tcp dst-port=80 in-interface=ether1 action=redirect to-ports=8080\n\n# ограничение по содержимому запроса\n/ip firewall filter add chain=forward content="Host: example.com" action=drop\n\n# проверка регулярного выражения (быстро, без layer7)\n/ip firewall filter add chain=forward protocol=tcp content="|2f|2f|2e|2e|2e|2f|" action=drop', note: 'Регулярное выражение в content пишется в hex или в виде |hex|, чтобы не путать регулярные символы.' }
    ],
    steps: [
      { title: 'Определите, что маркируете', text: 'Гостевой трафик, определённый сервис, конкретный клиент.', cmd: 'Гость: src-address=192.168.90.0/24\nVoIP: dst-port=5060,5061', note: 'Чем проще признак, тем меньше нагрузка и выше предсказуемость.' },
      { title: 'Создайте маркировку в raw', text: 'Для policy routing маркировка ставится именно в raw.', cmd: '/ip firewall raw add chain=prerouting src-address=192.168.90.0/24 action=mark-routing new-routing-mark=guest', note: 'Для очередей достаточно mark-packet в mangle.' },
      { title: 'Привяжите маркировку к маршруту', text: 'Создайте маршрут с этой меткой.', cmd: '/ip route add dst-address=0.0.0.0/0 gateway=198.51.100.7 routing-mark=guest', note: 'Без маршрута метка просто висит без дела.' },
      { title: 'Добавьте ограничения против DoS', text: 'Лимит соединений и частоты пакетов для доверенных источников.', cmd: '/ip firewall filter add chain=forward protocol=tcp connection-limit=100,20,10 src-address-list=trusted action=drop', note: 'Параметры: общее число, сколько разрешено одному IP, сколько на порт, сколько в burst.' },
      { title: 'Проверьте нагрузку и логи', text: 'После включения сложных правил следите за процессором.', cmd: '/system resource print\n/log print where topics~"firewall"', note: 'Если CPU ушёл в 100% — упрощайте правила, отключайте layer7 на пиковых трафиках.' }
    ],
    pitfalls: [
      { t: 'mark-routing в mangle не работает', d: 'Маркировка маршрутизации работает только в raw на prerouting. В mangle она игнорируется.' },
      { t: 'После включения mangle пропал интернет', d: 'Проверьте, не поставили ли вы action=accept без passthrough=yes, который прерывает обработку цепочки.' },
      { t: 'layer7-правила грузят процессор', d: 'Ограничивайте область действия: конкретный порт или адрес, а не весь forward. Смотрите /system resource print.' },
      { t: 'Ограничение соединений блокирует легитимных клиентов', d: 'Например, за одним NAT у многих пользователей. Применяйте лимиты к отдельным интерфейсам или адрес-листам, а не ко всем.' }
    ],
    checklist: [
      'Я знаю разницу между mangle и raw',
      'Я понимаю, что mark-routing работает только в raw',
      'Я умею маркировать трафик для очередей и для маршрутизации',
      'Я знаю, как ограничить число соединений и частоту пакетов',
      'Я понимаю цену layer7-правил для процессора',
      'Я умею читать логи firewall'
    ],
    quiz: [
      { q: 'Где должна стоять маркировка mark-routing для policy routing?', o: ['В таблице mangle', 'В таблице raw на цепочке prerouting', 'В таблице filter', 'В таблице nat'], a: 1, why: 'Только raw работает до принятия решения о маршрутизации; в mangle маркировка маршрутизации игнорируется.' },
      { q: 'Какая таблица позволяет быстро отбрасывать трафик без учёта соединений?', o: ['filter', 'raw', 'nat', 'mangle'], a: 1, why: 'raw работает до conntrack, поэтому дешевле по ресурсам.' },
      { q: 'Что делает connection-limit?', o: ['Ограничивает скорость', 'Ограничивает число одновременных соединений', 'Блокирует конкретный порт', 'Меняет TTL'], a: 1, why: 'Полезно против флуд-атак: клиент не может открыть тысячи соединений.' },
      { q: 'Почему layer7-правила дорогие?', o: ['Требуют лицензию', 'Нужно разбирать содержимое каждого пакета, нагружая процессор', 'Работают только на x86', 'Требуют перезагрузки'], a: 1, why: 'Разбор содержимого пакетов стоит CPU, поэтому правила применяют точечно.' },
      { q: 'Зачем нужен set-ttl?', o: ['Для QoS', 'Чтобы пакеты не зацикливались в петлях маршрутизации', 'Чтобы скрыть сеть', 'Для балансировки'], a: 1, why: 'TTL уменьшается на каждом хопе; при петле пакет исчезнет сам, а не будет кружиться вечно.' }
    ],
    cheat: [
      { g: 'Mangle', c: '/ip firewall mangle add chain=prerouting action=mark-packet new-packet-mark=guest', d: 'Маркировать пакет' },
      { g: 'Mangle', c: '/ip firewall mangle add chain=prerouting action=mark-connection new-connection-mark=conn1', d: 'Маркировать соединение' },
      { g: 'Raw', c: '/ip firewall raw add chain=prerouting action=mark-routing new-routing-mark=guest', d: 'Маркировка для policy routing' },
      { g: 'Защита', c: '/ip firewall filter add chain=forward protocol=tcp connection-limit=100,20,10 action=drop', d: 'Лимит соединений' },
      { g: 'Защита', c: '/ip firewall filter add chain=forward protocol=tcp connection-rate=100,10 action=drop', d: 'Защита от syn-flood' },
      { g: 'Защита', c: '/ip firewall filter add chain=input log=yes log-prefix=FIREWALL', d: 'Логирование правила' }
    ],
    summary: 'mangle — метки, TTL, DSCP; raw — до conntrack, там работает mark-routing. Для защиты используйте connection-limit и connection-rate. Layer7 включайте точечно, следите за CPU.'
  };
})();
