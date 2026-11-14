/* Глава 11. Автоматизация и скрипты */
(function () {
  const D = window.MIK_DATA;

  D.chapters.push({
    id: 'ch11', num: 11, icon: '🤖', title: 'Автоматизация',
    summary: 'Скрипты RouterOS, планировщик, netwatch и REST API для управления сетью.',
    lessons: ['l17']
  });

  D.lessons['l17'] = {
    title: 'Скрипты, планировщик, netwatch и REST API',
    lead: 'Роутер умеет сам реагировать на события и выполнять задачи по расписанию — разбираемся, как это использовать.',
    level: 5, time: '16 мин', tags: ['scripting', 'scheduler', 'netwatch', 'api'],
    video: 'assets/media/video/l17.mp4',
    videoCap: 'Видео: скрипты, scheduler и REST API',
    transcript: [
      'RouterOS умеет выполнять команды по расписанию и реагировать на события. Это то, что превращает роутер из коробки с настройками в управляемый элемент сети.',
      'Скрипты на RouterOS пишутся на собственном языке. Это не Shell и не Python, а простой интерпретатор с полезными командами: log, put, set, find, foreach, while, delay, а также вызовы /tool. Переменные начинаются с доллара.',
      'Базовый пример: пинговать интернет каждые пять минут и писать результат в журнал. Скрипт выглядит так: переменная result равна результату /ping, затем идёт log info с текстом. Такой скрипт полезен для мониторинга качества канала.',
      'Второй механизм — планировщик. Он запускает скрипт по расписанию: например, каждые пять минут, или раз в час, или при загрузке системы. Отдельно стоит политика выполнения: если скрипт упал, нужно ли запускать следующий.',
      'Третий механизм — netwatch. Он следит за доступностью узла и при изменении состояния выполняет скрипт. Это основа отказоустойчивости: если пинг до провайдера пропал, переключаем маршрут на резервный канал.',
      'Netwatch и планировщик вместе дают полноценный failover. Netwatch следит за основным шлюзом, а по событию down скрипт меняет расстояния маршрутов или поднимает запасной интерфейс.',
      'И четвёртый — REST API. Это HTTP-интерфейс к конфигурации: можно получить JSON с текущими настройками и изменить их обычным HTTP-запросом. Именно так работают Ansible, Terraform-провайдеры, скрипты на Python и системы мониторинга.',
      'API работает через сервис api на порту 8728 или через www-интерфейс по HTTPS. Для аутентификации используется обычная учётная запись RouterOS, а транспорт лучше защищать через VPN или ограничение по адресу.'
    ],
    blocks: [
      { t: 'h', x: 'Язык скриптов RouterOS' },
      { t: 'ul', x: [
        '`:global` — глобальная переменная, `:local` — локальная.',
        '`$var` — переменная, `($var)` — подстановка значения.',
        '`log info "текст"` — вывод в журнал.',
        '`/ping 8.8.8.8 count=3` — вызов команды и получение результата.',
        '`:foreach item in=$array do={ ... }` — цикл.',
        '`:while, :for, :if, :do` — управление потоком.',
        '`/system script run name=...` — запуск скрипта из другого места.'
      ] },
      { t: 'code', ttl: 'RouterOS CLI — скрипт', x: '/system script add name=check-internet source={\n    :local pingResult [/ping 8.8.8.8 count=3];\n    :local ok [:pick $pingResult 0];\n    :if ($ok = "3") do={\n        :log info "Internet: OK (3/3)";\n    } else={\n        :log warning "Internet: FAIL";\n    }\n}\n\n/system script run check-internet\n/log print where message~"Internet"', note: 'В RouterOS 7.16+ появился новый движок скриптов с новым синтаксисом. Старый синтаксис продолжает работать.' },

      { t: 'h', x: 'Планировщик' },
      { t: 'code', ttl: 'RouterOS CLI — scheduler', x: '/system scheduler add name=hourly-report interval=1h on-event={\n    /system script run check-internet;\n    /ip dhcp-server lease print;\n} policy=read,script,policy start-time=startup\n\n/system scheduler print', note: 'Политика определяет, какие команды разрешены скрипту. Минимально: read, script, policy.' },

      { t: 'h', x: 'Netwatch и failover' },
      { t: 'code', ttl: 'RouterOS CLI — переключение канала', x: '/tool netwatch add name=isp-ping host=203.0.113.9 interval=30s timeout=3s \\\n    down-script={\n        /ip route set [find distance=1] distance=20;\n        /ip route set [find distance=20 && gateway=203.0.113.9] distance=1;\n        :log warning "ISP1 down, switched to backup";\n    } up-script={\n        /ip route set [find gateway=203.0.113.9] distance=1;\n        :log info "ISP1 restored";\n    }\n\n/tool netwatch print', note: 'Проверяйте логику: при переключении туда-обратно distance меняется местами, иначе получится «залипание» на резервном канале.' },

      { t: 'h', x: 'REST API' },
      { t: 'code', ttl: 'RouterOS CLI — доступ к API', x: '# включаем сервис и ограничиваем его источник\n/ip service set api address=192.168.88.10/32\n\n# создаём пользователя для автоматизации\n/user group add name=api-group policy=api,read,write\n/user add name=ansible group=api-group password=ApiPass\n\n# пример запроса (с компьютера)\ncurl -k -u ansible:ApiPass https://192.168.88.1/rest/system/resource', note: 'REST-интерфейс доступен на https://<ip>/rest/ при включённом www-сервисе или через сервис api на порту 8728 (REST-запросы идут на 8728 с префиксом /rest).' },
      { t: 'table', head: ['Инструмент', 'Что делает', 'Когда применять'], rows: [
        ['Ansible', 'Управляет парком устройств, idempotent', 'Массовые изменения конфигурации'],
        ['Terraform', 'Декларативное описание инфраструктуры', 'Код в репозитории, повторяемость'],
        ['Python + requests', 'Свои скрипты и интеграции', 'Нестандартные задачи, отчёты'],
        ['NetBox', 'База активов и IPAM', 'Учёт сети, IP-адресация'],
        ['Zabbix/LibreNMS', 'Мониторинг через SNMP/API', 'Графики, алерты, история']
      ] }
    ],
    steps: [
      { title: 'Проверьте политику скриптов', text: 'Скрипту нужны права: read, script, policy, write.', cmd: '/system script print detail', note: 'Если скрипт не может изменить маршрут, добавьте policy=write в его policy.' },
      { title: 'Напишите первый скрипт', text: 'Начните с простого: пинг и запись результата в лог.', cmd: '/system script add name=test source={ :log info "test run"; }', note: 'Тестируйте скрипт вручную: /system script run name=test, и смотрите /log print.' },
      { title: 'Назначьте расписание', text: 'Планировщик запускает скрипт по интервалу.', cmd: '/system scheduler add name=every-5min interval=5m on-event={ /system script run test; } policy=read,script,policy', note: 'Для ежедневных задач есть start-time=00:30:00 с интервалом 1d.' },
      { title: 'Добавьте netwatch для failover', text: 'Следите за шлюзом и переключайте маршруты по событию.', cmd: '/tool netwatch add name=isp1 host=203.0.113.9 interval=30s down-script={ /log warning "ISP down"; }', note: 'Проверяйте логику переключения в обе стороны — down и up.' },
      { title: 'Откройте API для автоматизации', text: 'Включите сервис, ограничьте адрес, создайте пользователя.', cmd: '/ip service set api address=192.168.88.10/32', note: 'Никогда не выставляйте API в интернет. Только VPN или локальная сеть.' },
      { title: 'Проверьте API запросом', text: 'С компьютера сделайте запрос и посмотрите JSON.', cmd: 'curl -k -u ansible:ApiPass https://192.168.88.1/rest/system/resource', note: 'Если пришлось использовать -k, значит сертификат устройства не установлен в доверенные.' }
    ],
    pitfalls: [
      { t: 'Скрипт не выполняется', d: 'Проверьте policy скрипта и планировщика: нужны права read, script, policy, write. Смотрите /log print.' },
      { t: 'Ошибка синтаксиса в скрипте', d: 'Всегда заканчивайте команды точкой с запятой, используйте фигурные скобки и кавычки правильно. Проверяйте на копии устройства.' },
      { t: 'Netwatch переключает канал туда-обратно неправильно', d: 'Ошибка в логике up-script: маршруты не возвращаются в исходное состояние. Всегда пишите обе ветки симметрично.' },
      { t: 'API не отвечает', d: 'Сервис api выключен или привязан к другому адресу. Проверьте /ip service print и наличие сертификата для HTTPS.' },
      { t: 'Скрипт съел процессор', d: 'Скрипт с бесконечным циклом или слишком частым интервалом. Добавьте задержку :delay и ограничьте интервал.' }
    ],
    checklist: [
      'Я написал скрипт и запустил его вручную',
      'Я задал скрипту правильные права',
      'Я настроил планировщик с интервалом',
      'Я сделал failover на netwatch и проверил обе ветки',
      'Я включил API, ограничил его адресом и завёл отдельного пользователя',
      'Я понимаю, что REST API отдаёт JSON и принимает изменения'
    ],
    quiz: [
      { q: 'Какая переменная в RouterOS объявляется через :global?', o: ['$var', ':global $var', 'global $var', '$global.var'], a: 1, why: 'Синтаксис: :global myVar value.' },
      { q: 'Для чего нужен netwatch?', o: ['Шейпинг трафика', 'Отслеживание доступности узла и выполнение скрипта при смене состояния', 'Шифрование', 'Резервное копирование'], a: 1, why: 'Netwatch — основа автоматического failover между каналами.' },
      { q: 'Какой порт использует сервис api?', o: ['80', '8728', '8729', '443'], a: 1, why: 'API работает на порту 8728 (REST-запросы: /rest/...).' },
      { q: 'Почему нельзя держать API открытым в интернете?', o: ['Не поддерживается', 'API даёт полный контроль над конфигурацией устройства', 'Медленно работает', 'Требует лицензию'], a: 1, why: 'Через API можно получить и изменить любую настройку, включая пароли.' },
      { q: 'Где смотреть ошибки выполнения скрипта?', o: ['В консоли Winbox', 'В /log print по сообщениям скрипта', 'В /system resource', 'В /interface print'], a: 1, why: 'Каждый :log пишет в журнал; также есть /system script print detail.' }
    ],
    cheat: [
      { g: 'Скрипты', c: '/system script add name=test source={ :log info "hi"; }', d: 'Создать скрипт' },
      { g: 'Скрипты', c: '/system script run name=test', d: 'Запустить скрипт' },
      { g: 'Скрипты', c: '/system scheduler add name=every-5min interval=5m on-event={ /system script run test; }', d: 'Задание по расписанию' },
      { g: 'Скрипты', c: '/tool netwatch add name=isp1 host=203.0.113.9 interval=30s down-script={}', d: 'Слежение за узлом' },
      { g: 'Скрипты', c: '/tool netwatch print', d: 'Состояние netwatch' },
      { g: 'API', c: '/ip service set api address=192.168.88.10/32', d: 'Ограничить API по адресу' },
      { g: 'API', c: 'curl -k -u user:pass https://192.168.88.1/rest/system/resource', d: 'Запрос к REST API' }
    ],
    summary: 'Скрипты RouterOS пишутся на своём языке и запускаются вручную, по расписанию или по событию netwatch. Для failover комбинируйте netwatch с изменением distance. REST API открывайте только для доверенных адресов и отдельного пользователя.'
  };
})();
