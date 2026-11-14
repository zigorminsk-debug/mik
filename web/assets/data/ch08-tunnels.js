/* Глава 9. PPP и туннели */
(function () {
  const D = window.MIK_DATA;

  D.chapters.push({
    id: 'ch09', num: 9, icon: '🌉', title: 'Туннели',
    summary: 'PPPoE, L2TP, GRE, EoIP и WireGuard: как связать площадки и удалённых сотрудников.',
    lessons: ['l15']
  });

  D.lessons['l15'] = {
    title: 'PPPoE, L2TP, GRE, EoIP и WireGuard',
    lead: 'Разбираем технологии связи между площадками и выбираем правильный туннель под задачу: скорость, шифрование, совместимость.',
    level: 5, time: '18 мин', tags: ['pppoe', 'l2tp', 'gre', 'wireguard', 'eoip'],
    video: 'assets/media/video/l15.mp4',
    videoCap: 'Видео: PPPoE и туннели между площадками',
    transcript: [
      'PPPoE — это протокол, по которому провайдеры чаще всего выдают интернет по телефонной линии. Клиент отправляет PPP-запрос в PPPoE-сессию, а провайдер возвращает адрес, шлюз и DNS. На MikroTik это отдельный интерфейс, который живёт поверх физического порта.',
      'Настройка простая: создаёте PPP-профиль с именем и логином, а затем клиент, который ссылается на этот профиль и на физический интерфейс. В PPP-профиле можно задать use-peer-dns и use-peer-ntp, чтобы получать от провайдера DNS и время.',
      'Важный момент: PPP-интерфейс не привязан к адресу напрямую, у него свой адрес. Маршрут по умолчанию появляется автоматически, но если у вас два провайдера, задайте distance для каждого клиента явно.',
      'Теперь туннели между площадками. GRE — это простой туннель без шифрования: он инкапсулирует IP-пакеты в IP-пакеты. Скорость максимальная, но данные летят открыто, поэтому GRE обычно используют только внутри уже защищённого канала или в паре с IPsec.',
      'EoIP — это туннель второго уровня. Он переносит не IP-пакеты, а Ethernet-кадры, и это даёт возможность пробрасывать мост между площадками, работать с VLAN и запускать протоколы, которые не любят NAT. Минус — нет шифрования и ограниченная пропускная способность.',
      'L2TP — самый распространённый вариант для доступа удалённых сотрудников. Он работает поверх UDP, поэтому проходит через большинство сетей, но шифрования в нём нет: обязательно добавляйте IPsec, и тогда схема называется L2TP/IPsec.',
      'WireGuard — современная альтернатива. Он в ядре Linux, работает на уровне ядра, поэтому даёт скорость, близкую к гигабиту даже на слабом устройстве. Шифрование встроено, конфигурация минимальная, ключи удобно управляются.',
      'Для IPsec на MikroTik есть два режима. IKEv2 с современными шифрами и EAP — удобный выбор для клиентов. Режим transport с сертификатами или PSK — классика для site-to-site между маршрутизаторами. И помните: IPsec в RouterOS требует лицензию выше базовой.'
    ],
    blocks: [
      { t: 'h', x: 'Сравнение туннелей' },
      { t: 'table', head: ['Технология', 'Уровень', 'Шифрование', 'Типичное применение'], rows: [
        ['PPPoE', 'L2/L3', 'Нет', 'Доступ в интернет от провайдера'],
        ['GRE', 'L3', 'Нет (обычно с IPsec)', 'Site-to-site, связность OSPF/BGP'],
        ['EoIP', 'L2', 'Нет', 'Мост между филиалами, VLAN, прокси-ARP'],
        ['L2TP/IPsec', 'L2 + IPsec', 'Да (IPsec)', 'Доступ удалённых сотрудников'],
        ['WireGuard', 'L3', 'Да (встроено)', 'Современный site-to-site и remote access'],
        ['IPsec', 'L3', 'Да', 'Защита канала, site-to-site']
      ] },

      { t: 'h', x: 'PPPoE' },
      { t: 'code', ttl: 'RouterOS CLI — PPPoE', x: '/ppp profile add name=isp name=isp use-peer-dns=yes use-peer-ntp=yes\n\n/ppp secret add name=isp password="Pass123" service=pppoe profile=isp\n\n/interface pppoe-client add name=pppoe1 interface=ether1 user=isp password="Pass123" \\\n    default-route-distance=1 use-peer-dns=yes max-mtu=1492\n\n/interface pppoe-client print\n/ip address print', note: 'max-mtu=1492 указывайте, если провайдер требует уменьшенный MTU (обычно 1492 при PPPoE).' },

      { t: 'h', x: 'GRE между площадками' },
      { t: 'code', ttl: 'RouterOS CLI — GRE', x: '/interface gre add name=gre1 remote-address=203.0.113.2 local-address=203.0.113.1 \\\n    allow-fast-path=yes keepalive=10s,20\n\n/ip address add address=10.99.0.1/30 interface=gre1\n/ip route add dst-address=10.99.0.0/30 interface=gre1\n\n# OSPF поверх туннеля\n/routing ospf interface-template add area=backbone networks=10.99.0.0/30 type=point-to-point', note: 'Если OSPF бежит по GRE, укажите интерфейс в networks и уменьшите cost, иначе OSPF может выбрать физический канал вместо туннеля.' },

      { t: 'h', x: 'EoIP: мост между филиалами' },
      { t: 'code', ttl: 'RouterOS CLI — EoIP', x: '/interface eoip add name=eoip1 remote-address=203.0.113.2 tunnel-id=100 local-address=203.0.113.1 keepalive=10s,20\n\n# добавляем туннель в мост\n/interface bridge port add bridge=bridge1 interface=eoip1\n\n# или отдельный мост для EoIP\n/interface bridge add name=br-eoip\n/interface bridge port add bridge=br-eoip interface=eoip1', note: 'Через EoIP пробрасываются VLAN, broadcast и ARP. Это удобно для прокси-ARP и схем с прозрачными мостами.' },

      { t: 'h', x: 'WireGuard: современный выбор' },
      { t: 'code', ttl: 'RouterOS CLI — WireGuard', x: '/interface wireguard add name=wg0 listen-port=13231\n\n/interface wireguard peers add name=branch1 \\\n    public-key="xTIBA5xroQGo9D4HuFFfusjdiGJLwhpHT9/WxZ2DWCM=" \\\n    allowed-address=10.99.1.0/24 persistent-keepalive=25s\n\n/ip address add address=10.99.1.1/24 interface=wg0\n/ip route add dst-address=10.99.1.0/24 interface=wg0\n\n/interface wireguard print\n/interface wireguard peers print', note: 'В RouterOS 7 ключи генерируются на устройстве: /interface wireguard generate. Публичный ключ клиента указывается в peer.' },

      { t: 'h', x: 'L2TP/IPsec для сотрудников' },
      { t: 'code', ttl: 'RouterOS CLI — L2TP и IPsec', x: '/ip ipsec profile add name=ike enc-algorithm=aes-256 hash-algorithm=sha256 dh-group=modp2048 lifetime=8h\n/ip ipsec peer add name=peer1 address=0.0.0.0/0 profile=ike exchange-mode=ike2\n\n/ip ipsec identity add peer=peer1 auth-method=eap2 certificate=server-cert\n\n/ip ipsec policy add peer=peer1 src-address=0.0.0.0/0 dst-address=0.0.0.0/0 \\\n    proposal=default tunnel-mode=ipsec\n\n/ip ipsec proposal add name=default enc-algorithm=aes-256 hash-algorithm=sha256 auth-algorithm=hmac-sha-256\n\n/interface l2tp server set enabled=yes authentication=local\n/ppp profile add name=l2tp local-address=192.168.88.1 remote-address=10.10.10.1\n/ppp secret add name=user1 password="Pass123" service=l2tp profile=l2tp local-address=192.168.88.1', note: 'L2TP без IPsec — это передача пароля в открытом виде. Всегда в паре с IPsec.' }
    ],
    steps: [
      { title: 'Выберите технологию под задачу', text: 'Удалённые сотрудники — L2TP/IPsec или WireGuard. Площадки — WireGuard, GRE+IPsec или EoIP.', cmd: 'Нужна скорость и простота → WireGuard\nНужен L2 (мост, VLAN) → EoIP\nНужна совместимость со старыми клиентами → L2TP/IPsec', note: 'WireGuard почти всегда лучший выбор, если нет требований legacy.' },
      { title: 'Настройте WAN и проверьте связь', text: 'Сначала обычный интернет, потом туннель поверх него.', cmd: '/ping 203.0.113.2 count=4', note: 'Если базовый пинг не идёт, туннель тоже не поднимется.' },
      { title: 'Создайте туннель', text: 'GRE, EoIP или WireGuard — в зависимости от выбора.', cmd: '/interface wireguard add name=wg0 listen-port=13231', note: 'Укажите адреса пиров и allowed-address: подсети, которые будут доступны через туннель.' },
      { title: 'Задайте адреса туннеля', text: 'Внутренняя подсеть площадок.', cmd: '/ip address add address=10.99.1.1/24 interface=wg0\n/ip route add dst-address=10.99.1.0/24 interface=wg0', note: 'В WireGuard маршруты часто создаются автоматически по allowed-address в пире.' },
      { title: 'Разрешите трафик в firewall', text: 'Туннель — это интерфейс, правила нужны как для любого другого.', cmd: '/ip firewall filter add chain=forward in-interface=wg0 action=accept\n/ip firewall filter add chain=input in-interface=wg0 action=accept', note: 'Без правил туннель поднимется, но трафик не пойдёт.' },
      { title: 'Проверьте туннель', text: 'Пингуйте удалённую площадку по внутреннему адресу.', cmd: '/ping 10.99.1.2 count=4\n/interface wireguard print', note: 'Для GRE смотрите keepalive и состояние туннеля в выводе интерфейса.' }
    ],
    pitfalls: [
      { t: 'PPPoE не подключается', d: 'Проверьте логин/пароль, имя сервиса в ppp secret, наличие PPPoE-сервиса на порту провайдера и совпадение VLAN (часто нужен VLAN ID провайдера).' },
      { t: 'GRE поднялся, но пинга нет', d: 'Проверьте маршруты на обеих сторонах и правила firewall для цепочек input и forward на интерфейс туннеля.' },
      { t: 'EoIP: петля в сети', d: 'Через EoIP пробрасываются broadcast-кадры. Если у вас два маршрута между площадками, может возникнуть петля. Используйте STP или разделяйте сегменты VLAN.' },
      { t: 'WireGuard не подключается', d: 'Проверьте, что UDP-порт открыт на NAT (в RouterOS для исходящего WireGuard это обычно не требуется), совпадают ли публичные ключи и allowed-address.' },
      { t: 'L2TP подключается, но без интернета', d: 'Не задан маршрут по умолчанию у клиента или не разрешён forward. Проверьте /interface l2tp server print и /ip firewall filter print stats.' }
    ],
    checklist: [
      'Я настроил PPPoE-клиент на WAN-интерфейсе',
      'Я знаю, чем GRE отличается от EoIP',
      'Я умею создавать WireGuard-пиров и управлять ключами',
      'Я понимаю, что L2TP требует IPsec',
      'Я не забыл правила firewall для туннельных интерфейсов',
      'Я проверил связность по внутренним адресам площадок'
    ],
    quiz: [
      { q: 'Какой туннель переносит Ethernet-кадры второго уровня?', o: ['GRE', 'EoIP', 'WireGuard', 'L2TP'], a: 1, why: 'EoIP туннелирует L2-кадры, что позволяет пробрасывать VLAN и broadcast.' },
      { q: 'Чем GRE отличается от WireGuard?', o: ['GRE шифрует', 'GRE не шифрует и проще, WireGuard шифрует и быстрее', 'GRE работает только на 5 ГГц', 'Разницы нет'], a: 1, why: 'GRE — простая инкапсуляция без шифрования; WireGuard современнее и безопаснее.' },
      { q: 'Почему L2TP используют только вместе с IPsec?', o: ['Из-за лицензии', 'Сам L2TP не шифрует и передаёт пароль в открытом виде', 'L2TP не работает на MikroTik', 'IPsec ускоряет L2TP'], a: 1, why: 'Без IPsec схема L2TP небезопасна, особенно через интернет.' },
      { q: 'Какая команда создаёт WireGuard-интерфейс?', o: ['/interface gre add', '/interface wireguard add name=wg0', '/ip ipsec policy add', '/interface eoip add'], a: 1, why: 'WireGuard настраивается через /interface wireguard и /interface wireguard peers.' },
      { q: 'Туннель поднялся, но трафик не идёт. Что проверить в первую очередь?', o: ['Лицензию', 'Правила firewall для интерфейса туннеля', 'DNS', 'Версию RouterOS'], a: 1, why: 'Туннельный интерфейс — обычный интерфейс, для него нужны accept в input и forward.' }
    ],
    cheat: [
      { g: 'PPPoE', c: '/ppp profile add name=isp use-peer-dns=yes', d: 'PPP-профиль провайдера' },
      { g: 'PPPoE', c: '/interface pppoe-client add name=pppoe1 interface=ether1 user=isp password="Pass"', d: 'PPPoE-клиент' },
      { g: 'Туннели', c: '/interface gre add name=gre1 remote-address=203.0.113.2', d: 'GRE-туннель' },
      { g: 'Туннели', c: '/interface eoip add name=eoip1 tunnel-id=100 remote-address=203.0.113.2', d: 'EoIP-туннель' },
      { g: 'Туннели', c: '/interface wireguard add name=wg0 listen-port=13231', d: 'WireGuard-интерфейс' },
      { g: 'Туннели', c: '/interface wireguard peers add public-key="..." allowed-address=10.99.1.0/24', d: 'Пир WireGuard' },
      { g: 'IPsec', c: '/ip ipsec policy add peer=peer1 tunnel-mode=ipsec proposal=default', d: 'Политика IPsec' }
    ],
    summary: 'PPPoE — доступ в интернет. GRE — быстрый site-to-site без шифрования. EoIP — прозрачный мост между площадками. WireGuard — современный выбор с шифрованием из коробки. L2TP только вместе с IPsec. Для любого туннеля нужны правила firewall.'
  };
})();
