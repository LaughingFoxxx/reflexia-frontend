# Фронтенд для приложения

## Основные технологии:
- **JS + React**: как основа
- **AntDesign**: использовалась готовая библиотека элементов для создания красивого и минималистичного интерфейса. Для кастомизации и создания темной и светлой версии веб-интерфейса готовые элементы AntDesign модифицировались через CSS
- **Axios**: для работы с запросами к backend

## Основные реализованные функции и страницы:
- **Лицевая страница** (landing)
- **Страница с формами логина и регистрации** (перелючение между формами логина и регистрации)
- **Страница ввода Email при смене пароля**
- **Страница ввода кода подтверждения Email** через специальную форму для OTP
- **Страница ввода нового пароля**
- **Главная страница с боковым меню**, в котором можно перелючаться между окнами "Мои документы", "Аккаунт" и "Настройки"
- **Мои документы**: страница с карточками, содержащими документы пользователя
- **Аккаунт**: (*в разработке: кастомизация профиля*) выход из аккаунта
- **Настройки**: (*в разработке: смена языка интерфейса*) светлая и темная тема, смена размера и стиля шрифта для текстового редактора
- **Текстовый редактор**: текстовый редактор на основе React-quill, через который реализовано взаимодействие пользователя с ИИ через всплывающие окна для редактирования текста
- **Адаптив** для всего вышеперечисленного

### Основной backend-проект: https://github.com/LaughingFoxxx/reflexia
