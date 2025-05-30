import React, { useState, useRef, useEffect } from 'react';
import { Layout, Menu, Button, Card, Space, Spin, message, Modal, Upload, Dropdown, Menu as AntdMenu } from 'antd';
import {
    FileTextOutlined,
    UserOutlined,
    SettingOutlined,
    PlusOutlined,
    CloseOutlined,
    LoadingOutlined,
    DeleteOutlined,
    LogoutOutlined,
    CopyOutlined,
    UploadOutlined,
    ExportOutlined,
    DownOutlined,
    EllipsisOutlined,
    UpOutlined,
    DownOutlined as MinimizeOutlined,
    LeftOutlined,
    RightOutlined
} from '@ant-design/icons';
import ReactQuill from 'react-quill';
import ReactMarkdown from 'react-markdown';
import 'react-quill/dist/quill.snow.css';
import './App.css';
import SettingsPage from './SettingsPage.jsx';
import AccountPage from './AccountPage.jsx';
import { useNavigate } from 'react-router-dom';
import {Content} from "antd/es/layout/layout.js";
import Sider from "antd/es/layout/Sider.js";

// Вспомогательная функция для удаления HTML-тегов
const stripHtml = (html) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
};

const App = () => {
    const [selectedMenu, setSelectedMenu] = useState('documents');
    const [currentDoc, setCurrentDoc] = useState(null);
    const [editorContent, setEditorContent] = useState('');
    const [originalContent, setOriginalContent] = useState('');
    const [selection, setSelection] = useState(null);
    const [processedResponses, setProcessedResponses] = useState([]); // Array of { text: string }
    const [currentResponseIndex, setCurrentResponseIndex] = useState(-1);
    const [isProcessing, setIsProcessing] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 1100);
    const [documents, setDocuments] = useState([]);
    const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
    const [fetchError, setFetchError] = useState(null);
    const [isDocumentsFetched, setIsDocumentsFetched] = useState(false);
    const isFetchingRef = useRef(false);
    const quillRef = useRef(null);
    const inputRef = useRef(null);
    const previewRef = useRef(null);
    const submitButtonRef = useRef(null);
    const closeButtonRef = useRef(null);
    const [documentToDelete, setDocumentToDelete] = useState(null);
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(false);
    const [isPreviewMinimized, setIsPreviewMinimized] = useState(false);

    // Отслеживание изменения размера экрана
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 1240);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Применение начальных настроек
    useEffect(() => {
        const initialDarkMode = localStorage.getItem('darkMode') === 'true';
        document.body.classList.toggle('dark-theme', initialDarkMode);
        const initialFontSize = localStorage.getItem('editorFontSize') || '16';
        const initialFontFamily = localStorage.getItem('editorFontFamily') || "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
        document.documentElement.style.setProperty('--editor-font-size', `${initialFontSize}px`);
        document.documentElement.style.setProperty('--editor-font-family', initialFontFamily);
    }, []);

    // Глобальный обработчик кликов для сброса имитации выделения
    useEffect(() => {
        const handleGlobalClick = (event) => {
            if (
                quillRef.current &&
                inputRef.current &&
                previewRef.current &&
                submitButtonRef.current &&
                closeButtonRef.current &&
                toggleButtonRef.current &&
                !quillRef.current.getEditor().root.contains(event.target) &&
                !inputRef.current.contains(event.target) &&
                !submitButtonRef.current.contains(event.target) &&
                !closeButtonRef.current.contains(event.target) &&
                !toggleButtonRef.current.contains(event.target) // Исключаем кнопку сворачивания
            ) {
                // Очищаем выделение в редакторе, но сохраняем processedResponses
                if (selection) {
                    clearBackgroundFormatting(false);
                }
            }
        };

        document.addEventListener('click', handleGlobalClick);
        return () => document.removeEventListener('click', handleGlobalClick);
    }, [selection]);

    // Функция для очистки фонового форматирования
    const clearBackgroundFormatting = (clearPreview = true) => {
        if (quillRef.current) {
            const quill = quillRef.current.getEditor();
            const length = quill.getLength();
            quill.formatText(0, length, { background: false }, 'user');
            const cleanHtml = quill.root.innerHTML;
            setEditorContent(cleanHtml);
            setSelection(null);
            setAiPrompt('');
            if (clearPreview) {
                setProcessedResponses([]);
                setCurrentResponseIndex(-1);
                setIsPreviewMinimized(false);
            }
            return cleanHtml;
        }
        return editorContent;
    };

    // Функция выхода из аккаунта
    const handleLogout = async () => {
        try {
            const response = await fetch('http://localhost:8082/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
            });

            if (response.ok) {
                message.success('Выход выполнен');
                navigate('/login');
            } else {
                throw new Error('Failed to logout');
            }
        } catch (error) {
            console.error('Logout failed:', error);
            message.error('Ошибка при выходе из аккаунта');
        }
    };

    // Функция удаления документа
    const handleDeleteDocument = async (docId) => {
        try {
            const response = await fetch(`http://localhost:8082/api/text/delete-document?documentId=${docId}`, {
                method: 'DELETE',
                credentials: 'include',
            });

            if (response.status === 401) {
                const refreshResponse = await fetch('http://localhost:8082/api/auth/refresh', {
                    method: 'POST',
                    credentials: 'include',
                });

                if (!refreshResponse.ok) {
                    throw new Error('Failed to refresh token');
                }

                const retryResponse = await fetch(`http://localhost:8082/api/text/delete-document?documentId=${docId}`, {
                    method: 'DELETE',
                    credentials: 'include',
                });

                if (!retryResponse.ok) {
                    throw new Error(`HTTP error ${retryResponse.status}`);
                }
            } else if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }

            setDocuments(prevDocs => prevDocs.filter(doc => doc.id !== docId));
            message.success('Документ удален');
            if (currentDoc?.id === docId) {
                setCurrentDoc(null);
                setEditorContent('');
            }
        } catch (error) {
            console.error('Failed to delete document:', error);
            message.error(`Ошибка при удалении документа: ${error.message}`);
        }
    };

    // Подтверждение удаления
    const confirmDelete = (doc) => {
        setDocumentToDelete(doc);
        Modal.confirm({
            title: 'Удалить документ?',
            content: `Вы уверены, что хотите удалить документ "${doc.title}"? Это действие нельзя отменить.`,
            okText: 'Удалить',
            okType: 'danger',
            cancelText: 'Отмена',
            onOk: () => {
                handleDeleteDocument(doc.id);
                setDocumentToDelete(null);
            },
            onCancel: () => {
                setDocumentToDelete(null);
            },
            className: 'custom-delete-modal',
            centered: true,
        });
    };

    // Функция для получения документов
    const fetchDocuments = async (isRetryAfterRefresh = false) => {
        if (isFetchingRef.current && !isRetryAfterRefresh) return;
        if (isDocumentsFetched && !isRetryAfterRefresh) return;

        isFetchingRef.current = true;
        setIsLoadingDocuments(true);
        setFetchError(null);

        try {
            const response = await fetch('http://localhost:8082/api/text/all-user-documents', {
                method: 'GET',
                credentials: 'include',
            });

            if (response.status === 401 && !isRetryAfterRefresh) {
                const refreshResponse = await fetch('http://localhost:8082/api/auth/refresh', {
                    method: 'POST',
                    credentials: 'include',
                });

                if (!refreshResponse.ok) {
                    throw new Error('Failed to refresh token');
                }

                return fetchDocuments(true);
            }

            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            let documentList = [];

            if (Array.isArray(data)) {
                documentList = data;
            } else if (data?.documents) {
                documentList = data.documents;
            } else if (data?.documentId && data?.documentName) {
                documentList = [data];
            } else {
                throw new Error("Unexpected data structure received from server.");
            }

            const formattedDocuments = documentList.map(doc => {
                if (!doc || typeof doc !== 'object') return null;
                const updatedAtDate = new Date(doc.updatedAt);
                const formattedDate = isNaN(updatedAtDate) ? 'Unknown Date' : updatedAtDate.toISOString().split('T')[0];
                const cleanText = stripHtml(doc.text || '');
                const previewText = cleanText.substring(0, 100) + (cleanText.length > 100 ? '...' : '') || `Начните печатать...`;

                return {
                    id: doc.documentId || `missing_id_${Math.random()}`,
                    title: doc.documentName || 'Untitled Document',
                    date: formattedDate,
                    preview: previewText,
                    content: doc.text || '',
                    createdAt: doc.createdAt,
                    updatedAt: doc.updatedAt,
                };
            }).filter(Boolean);

            setDocuments(formattedDocuments);
            setIsDocumentsFetched(true);
        } catch (error) {
            setFetchError(error.message);
            message.error(`Failed to load documents: ${error.message}`);
        } finally {
            setIsLoadingDocuments(false);
            isFetchingRef.current = false;
        }
    };

    // Вызов fetchDocuments только при монтировании или первом переходе на 'documents'
    useEffect(() => {
        if (selectedMenu === 'documents' && !currentDoc && !isDocumentsFetched && !isFetchingRef.current) {
            fetchDocuments();
        }
    }, [selectedMenu, currentDoc]);

    // Функция загрузки файла
    const handleUploadFile = async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('http://localhost:8082/api/text/upload-document-file', {
                method: 'POST',
                body: formData,
                credentials: 'include',
            });

            if (response.status === 401) {
                const refreshResponse = await fetch('http://localhost:8082/api/auth/refresh', {
                    method: 'POST',
                    credentials: 'include',
                });

                if (!refreshResponse.ok) {
                    throw new Error('Failed to refresh token');
                }

                const retryResponse = await fetch('http://localhost:8082/api/text/upload-document-file', {
                    method: 'POST',
                    body: formData,
                    credentials: 'include',
                });

                if (!retryResponse.ok) {
                    throw new Error(`HTTP error ${retryResponse.status}`);
                }

                const retryData = await retryResponse.json();
                handleDocumentResponse(retryData);
            } else if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            } else {
                const data = await response.json();
                handleDocumentResponse(data);
            }

            return false;
        } catch (error) {
            console.error('Failed to upload file:', error);
            message.error(`Ошибка при загрузке файла: ${error.message}`);
            return false;
        }
    };

    // Обработка ответа сервера после загрузки документа
    const handleDocumentResponse = (doc) => {
        const updatedAtDate = new Date(doc.updatedAt);
        const formattedDate = isNaN(updatedAtDate) ? 'Unknown Date' : updatedAtDate.toISOString().split('T')[0];
        const cleanText = stripHtml(doc.text || '');
        const previewText = cleanText.substring(0, 100) + (cleanText.length > 100 ? '...' : '') || `Начните печатать...`;

        const formattedDoc = {
            id: doc.documentId,
            title: doc.documentName || 'Uploaded Document',
            date: formattedDate,
            preview: previewText,
            content: doc.text || '',
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
        };

        setDocuments(prevDocs => [formattedDoc, ...prevDocs]);
        setCurrentDoc(formattedDoc);
        setEditorContent(formattedDoc.content);
        setOriginalContent(formattedDoc.content);
        message.success('Документ успешно загружен и открыт');
    };

    const menuItems = [
        { key: 'documents', icon: <FileTextOutlined />, label: 'Мои документы' },
        { key: 'account', icon: <UserOutlined />, label: 'Аккаунт' },
        { key: 'settings', icon: <SettingOutlined />, label: 'Настройки' },
    ];

    const handleSelectionChange = () => {
        if (quillRef.current) {
            const quill = quillRef.current.getEditor();
            const range = quill.getSelection();
            if (range && range.length > 0) {
                if (selection) {
                    quill.formatText(selection.range.index, selection.range.length, {
                        background: false,
                    });
                }
                const text = quill.getText(range.index, range.length);
                setSelection({ text, range });
                quill.formatText(range.index, range.length, {
                    background: document.body.classList.contains('dark-theme') ? '#508ec1' : '#fff9a8',
                });
            } else if (selection && document.activeElement !== inputRef.current) {
                clearBackgroundFormatting(false);
            }
        }
    };

    const handleInputClick = () => {
        if (quillRef.current && selection) {
            const quill = quillRef.current.getEditor();
            quill.formatText(selection.range.index, selection.range.length, {
                background: document.body.classList.contains('dark-theme') ? '#508ec1' : '#fff9a8',
            });
            inputRef.current.focus();
        }
    };

    const handleKeyDown = (event) => {
        if (quillRef.current && selection && (event.ctrlKey || event.metaKey) && event.key === 'z') {
            clearBackgroundFormatting(false);
        }
    };

    const handleProcessText = async () => {
        if (!selection || !selection.text || !aiPrompt.trim()) {
            message.error('Выделите текст и введите запрос для обработки');
            return;
        }

        setIsProcessing(true);
        if (isPreviewMinimized) {
            handleTogglePreview()
        }

        try {
            const payload = {
                instruction: aiPrompt,
                text: selection.text,
            };

            const response = await fetch('http://localhost:8082/api/text/process-text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
                credentials: 'include',
            });

            let resultText;
            if (response.status === 401) {
                const refreshResponse = await fetch('http://localhost:8082/api/auth/refresh', {
                    method: 'POST',
                    credentials: 'include',
                });

                if (!refreshResponse.ok) {
                    throw new Error('Failed to refresh token');
                }

                const retryResponse = await fetch('http://localhost:8082/api/text/process-text', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                    credentials: 'include',
                });

                if (!retryResponse.ok) {
                    throw new Error(`HTTP error ${retryResponse.status}`);
                }

                const retryData = await retryResponse.json();
                resultText = retryData.result || 'Ошибка: пустой результат';
            } else if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            } else {
                const data = await response.json();
                resultText = data.result || 'Ошибка: пустой результат';
            }

            // Append new response and set index to the latest
            setProcessedResponses(prev => [...prev, { text: resultText }]);
            setCurrentResponseIndex(processedResponses.length);
        } catch (error) {
            console.error('Failed to process text:', error);
            setProcessedResponses(prev => [...prev, { text: `Ошибка обработки: ${error.message}` }]);
            setCurrentResponseIndex(processedResponses.length);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleNavigateResponse = (direction) => {
        setCurrentResponseIndex(prev => {
            const newIndex = direction === 'next' ? prev + 1 : prev - 1;
            return Math.max(0, Math.min(newIndex, processedResponses.length - 1));
        });
    };

    const handleReplaceText = () => {
        if (quillRef.current && selection && processedResponses[currentResponseIndex]) {
            const quill = quillRef.current.getEditor();
            quill.formatText(selection.range.index, selection.range.length, {
                background: false,
            });
            quill.deleteText(selection.range.index, selection.range.length);
            quill.insertText(selection.range.index, processedResponses[currentResponseIndex].text);
            setProcessedResponses([]);
            setCurrentResponseIndex(-1);
            setAiPrompt('');
            setSelection(null);
            setIsPreviewMinimized(false);
        }
    };

    const handleCopyText = () => {
        if (processedResponses[currentResponseIndex]) {
            navigator.clipboard.writeText(processedResponses[currentResponseIndex].text)
                .then(() => {
                    message.success('Текст скопирован в буфер обмена');
                })
                .catch((error) => {
                    console.error('Failed to copy text:', error);
                    message.error('Ошибка при копировании текста');
                });
        }
    };

    const handleCancelPreview = () => {
        setProcessedResponses([]);
        setCurrentResponseIndex(-1);
        setIsPreviewMinimized(false);
        if (selection) {
            clearBackgroundFormatting(true);
        }
    };

    const handleTogglePreview = () => {
        setIsPreviewMinimized(prev => !prev);
    };

    const handleCreateDocument = async () => {
        const newDocId = `new_${Date.now()}`;
        const initialTitle = 'Новый документ';
        const initialContent = '';

        const newDoc = {
            id: newDocId,
            title: initialTitle,
            content: initialContent,
            date: new Date().toISOString().split('T')[0],
            preview: 'Начните печатать...',
            isNew: true,
        };

        try {
            const payload = {
                documentId: newDocId,
                documentName: initialTitle,
                text: initialContent,
            };

            const response = await fetch('http://localhost:8082/api/text/create-new-document', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
                credentials: 'include',
            });

            if (response.status === 401) {
                const refreshResponse = await fetch('http://localhost:8082/api/auth/refresh', {
                    method: 'POST',
                    credentials: 'include',
                });

                if (!refreshResponse.ok) {
                    throw new Error('Failed to refresh token');
                }

                const retryResponse = await fetch('http://localhost:8082/api/text/create-new-document', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                    credentials: 'include',
                });

                if (!retryResponse.ok) {
                    throw new Error(`HTTP error ${retryResponse.status}`);
                }
            } else if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }

            const contentType = response.headers.get('Content-Type');
            let serverDoc = null;
            if (contentType && contentType.includes('application/json') && response.status !== 204) {
                serverDoc = await response.json();
            }

            const updatedDoc = {
                ...newDoc,
                id: serverDoc?.documentId || newDocId,
                title: serverDoc?.documentName || initialTitle,
                content: serverDoc?.text || initialContent,
                updatedAt: serverDoc?.updatedAt || new Date().toISOString(),
                isNew: false,
            };

            setCurrentDoc(updatedDoc);
            setEditorContent(initialContent);
            setOriginalContent(initialContent);
            setDocuments(prevDocs => [updatedDoc, ...prevDocs]);
            message.success('Документ создан');
        } catch (error) {
            console.error('Failed to create document:', error);
            message.error(`Ошибка при создании документа: ${error.message}`);
            setCurrentDoc(newDoc);
            setEditorContent(initialContent);
            setOriginalContent(initialContent);
            setDocuments(prevDocs => [newDoc, ...prevDocs]);
        }
    };

    const handleOpenDocument = (doc) => {
        setCurrentDoc(doc);
        setEditorContent(doc.content);
        setOriginalContent(doc.content);
        setSelection(null);
    };

    const handleClose = async () => {
        let cleanContent = editorContent;
        if (quillRef.current) {
            cleanContent = clearBackgroundFormatting(true);
        }

        if (cleanContent !== originalContent || currentDoc?.title !== currentDoc?.title) {
            await handleSave();
        }

        setCurrentDoc(null);
        setEditorContent('');
        setOriginalContent('');
    };

    const handleSave = async () => {
        if (!currentDoc) return;

        let cleanContent = editorContent;
        if (quillRef.current) {
            cleanContent = clearBackgroundFormatting(true);
        }

        const payload = {
            documentId: currentDoc.id,
            documentName: currentDoc.title,
            text: cleanContent,
        };

        const saveDocument = async (isRetryAfterRefresh = false) => {
            try {
                const response = await fetch('http://localhost:8082/api/text/save-document-changes', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                    credentials: 'include',
                });

                if (response.status === 401 && !isRetryAfterRefresh) {
                    const refreshResponse = await fetch('http://localhost:8082/api/auth/refresh', {
                        method: 'POST',
                        credentials: 'include',
                    });

                    if (!refreshResponse.ok) {
                        throw new Error('Failed to refresh token');
                    }

                    return saveDocument(true);
                }

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP error ${response.status}: ${errorText || 'Failed to save document'}`);
                }

                const contentType = response.headers.get('Content-Type');
                let updatedDocFromServer = null;

                if (contentType && contentType.includes('application/json') && response.status !== 204) {
                    updatedDocFromServer = await response.json();
                    console.log('Server response:', updatedDocFromServer);
                } else {
                    console.log('No JSON response from server, using local data');
                }

                const cleanText = stripHtml(updatedDocFromServer?.text || cleanContent);
                const updatedDoc = {
                    ...currentDoc,
                    title: updatedDocFromServer?.documentName || currentDoc.title,
                    content: updatedDocFromServer?.text || cleanContent,
                    date: new Date(updatedDocFromServer?.updatedAt || Date.now()).toISOString().split('T')[0],
                    preview: cleanText.substring(0, 100) + (cleanText.length > 100 ? '...' : ''),
                    updatedAt: updatedDocFromServer?.updatedAt || currentDoc.updatedAt || new Date().toISOString(),
                    isNew: false,
                };

                setCurrentDoc(updatedDoc);
                setOriginalContent(cleanContent);
                setDocuments(prevDocs =>
                    prevDocs.map(doc =>
                        doc.id === updatedDoc.id ? updatedDoc : doc
                    )
                );
                message.success('Документ сохранен');
            } catch (error) {
                console.error('Failed to save document:', error);
                message.error(`Ошибка сохранения: ${error.message}`);
            } finally {
                setIsLoadingDocuments(false);
            }
        };

        await saveDocument();
    };

    const modules = {
        toolbar: '#toolbar'
    };

    const formats = [
        'header',
        'bold', 'italic', 'underline', 'strike',
        'align',
        'color', 'background',
        'link', 'image',
        'list', 'bullet',
    ];

    const processingOptions = [
        {
            category: "Улучшение текста",
            options: [
                { name: "Повысить ясность", emoji: "👀" },
                { name: "Сделать короче", emoji: "✂️" },
                { name: "Развить мысль", emoji: "💡" },
                { name: "Исправить ошибки", emoji: "✏️" },
                { name: "Формальный тон", emoji: "📋" },
                { name: "Неформальный тон", emoji: "😊" },
                { name: "Упростить язык", emoji: "🔤" },
            ],
        },
        {
            category: "Генерация",
            options: [
                { name: "Пересказать", emoji: "🔄" },
                { name: "Придумать заголовок", emoji: "🏷️" },
                { name: "Найти задачи", emoji: "✅" },
                { name: "Продолжить писать", emoji: "➡️" },
                { name: "Создать список", emoji: "📜" },
                { name: "Написать введение", emoji: "📖" },
                { name: "Написать заключение", emoji: "🏁" },
            ],
        },
        {
            category: "Анализ и формат",
            options: [
                { name: "Извлечь ключевые слова", emoji: "🔍" },
                { name: "Определить тональность", emoji: "🎵" },
                { name: "Форматировать как Email", emoji: "📧" },
                { name: "Форматировать как Отчет", emoji: "📄" },
                { name: "Добавить Эмодзи", emoji: "😍" },
            ],
        },
        {
            category: "Перевод",
            options: [
                { name: "Перевести на Английский", emoji: "🌍" },
                { name: "Перевести на Немецкий", emoji: "🇩🇪" },
                { name: "Перевести на Французский", emoji: "🇫🇷" },
                { name: "Определить язык", emoji: "❓" },
            ],
        },
        {
            category: "Другое",
            options: [
                { name: "Объяснить это", emoji: "ℹ️" },
                { name: "Превратить в стих", emoji: "📝" },
                { name: "Сделать твит", emoji: "🐦" },
                { name: "Связанный факт", emoji: "🔗" },
            ],
        },
    ];

    const aiOptionsMenu = (
        <AntdMenu>
            {processingOptions.map(category => (
                <AntdMenu.SubMenu key={category.category} title={category.category}>
                    {category.options.map(option => (
                        <AntdMenu.Item
                            key={`${category.category}-${option.name}`}
                            onClick={() => {
                                const prompt = `${option.name} для выделенного текста`;
                                setAiPrompt(prompt);
                                if (selection && selection.text) {
                                    handleProcessText();
                                }
                            }}
                        >
                            {option.emoji} {option.name}
                        </AntdMenu.Item>
                    ))}
                </AntdMenu.SubMenu>
            ))}
        </AntdMenu>
    );

    const renderEditor = () => (
        <div className="editor-container">
            <div className="editor-header">
                <div className="title-wrapper">
                    <input
                        type="text"
                        value={currentDoc?.title || ''}
                        onChange={(e) => setCurrentDoc(prev => ({ ...prev, title: e.target.value }))}
                        className="document-title-input"
                        placeholder="Название документа"
                    />
                </div>
                <div id="toolbar" className="ql-toolbar ql-snow">
                    <span className="ql-formats">
                        <select className="ql-header">
                            <option value="1"></option>
                            <option value="2"></option>
                            <option value="3"></option>
                            <option selected></option>
                        </select>
                    </span>
                    <span className="ql-formats">
                        <button className="ql-bold"></button>
                        <button className="ql-italic"></button>
                        <button className="ql-underline"></button>
                        <button className="ql-strike"></button>
                    </span>
                    <span className="ql-formats">
                        <button className="ql-align" value=""></button>
                        <button className="ql-align" value="center"></button>
                        <button className="ql-align" value="right"></button>
                        <button className="ql-align" value="justify"></button>
                    </span>
                    <span className="ql-formats">
                        <button className="ql-link"></button>
                        <button className="ql-image"></button>
                    </span>
                    <span className="ql-formats">
                        <button className="ql-list" value="ordered"></button>
                        <button className="ql-list" value="bullet"></button>
                    </span>
                    <span className="ql-formats">
                        <button className="ql-clean"></button>
                    </span>
                </div>
                <Button
                    icon={<CloseOutlined />}
                    onClick={handleClose}
                    type="text"
                    className="close-button"
                    ref={closeButtonRef}
                />
            </div>
            <div className="editor-wrapper">
                <ReactQuill
                    ref={quillRef}
                    theme="snow"
                    value={editorContent}
                    onChange={setEditorContent}
                    onChangeSelection={handleSelectionChange}
                    onKeyDown={handleKeyDown}
                    className="custom-quill"
                    modules={modules}
                    formats={formats}
                />
                {(isProcessing || processedResponses.length > 0) && (
                    <div className={`ai-preview-container ${isPreviewMinimized ? 'minimized' : ''}`} ref={previewRef}>
                        <div className="preview-header">
                            <div className="response-navigation">
                                <Button
                                    icon={<LeftOutlined />}
                                    onClick={() => handleNavigateResponse('prev')}
                                    type="text"
                                    className="nav-button"
                                    disabled={currentResponseIndex <= 0}
                                />
                                <span className="response-info">
                                    {currentResponseIndex + 1} из {processedResponses.length}
                                </span>
                                <Button
                                    icon={<RightOutlined />}
                                    onClick={() => handleNavigateResponse('next')}
                                    type="text"
                                    className="nav-button"
                                    disabled={currentResponseIndex >= processedResponses.length - 1}
                                />
                            </div>
                            <Button
                                icon={isPreviewMinimized ? <UpOutlined /> : <MinimizeOutlined />}
                                onClick={handleTogglePreview}
                                type="text"
                                className="toggle-preview-button"
                            />
                        </div>
                        {!isPreviewMinimized && (
                            <>
                                {isProcessing ? (
                                    <div className="spinner-container">
                                        <Spin indicator={<LoadingOutlined spin />} size="large" />
                                    </div>
                                ) : (
                                    <div className="preview-content">
                                        <div className="preview-text">
                                            {processedResponses[currentResponseIndex] && (
                                                <ReactMarkdown>{processedResponses[currentResponseIndex].text}</ReactMarkdown>
                                            )}
                                        </div>
                                        <div className="preview-buttons">
                                            <Button onClick={handleCancelPreview}>Отменить</Button>
                                            <Button onClick={handleCopyText} icon={<CopyOutlined />}>Скопировать</Button>
                                            <Button type="primary" onClick={handleReplaceText}>Заменить</Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
                <div className="ai-input-container">
                    <Dropdown overlay={aiOptionsMenu}>
                        <Button className="ai-options-button" icon={<EllipsisOutlined />}/>
                    </Dropdown>
                    <input
                        ref={inputRef}
                        type="text"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        onClick={handleInputClick}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter' && !isProcessing) {
                                handleProcessText();
                            }
                        }}
                        placeholder={selection ? "Введите запрос для ИИ..." : "Выделите текст для активации"}
                        className="ai-input"
                        disabled={!selection}
                    />
                    <Button
                        ref={submitButtonRef}
                        type="primary"
                        onClick={handleProcessText}
                        disabled={!selection || !aiPrompt.trim() || isProcessing}
                        className="ai-submit-button"
                    >
                        Выполнить
                    </Button>
                </div>
            </div>
        </div>
    );

    const renderDocuments = () => {
        if (isLoadingDocuments) return <div className="centered-spin"><Spin indicator={<LoadingOutlined style={{ fontSize: 56 }} spin />} tip="Loading documents..." /></div>;
        if (fetchError) return <div className="centered-error">Error loading documents: {fetchError} <Button onClick={() => fetchDocuments()}>Retry</Button></div>;

        return (
            <div className="documents-container">
                <div style={{ display: 'flex', gap: '12px' }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateDocument} className="create-doc-btn">
                        Создать документ
                    </Button>
                    <Upload
                        beforeUpload={handleUploadFile}
                        showUploadList={false}
                        accept=".txt,.doc,.docx,.pdf"
                    >
                        <Button type="default" className="upload-btn" icon={<UploadOutlined />}>
                            Загрузить файл
                        </Button>
                    </Upload>
                </div>
                {documents.length === 0 ? (
                    <div className="no-documents-message">Нет сохраненных документов. Нажмите "Создать документ" или "Загрузить файл", чтобы начать.</div>
                ) : (
                    <div className="documents-grid">
                        {documents.map(doc => (
                            <div key={doc.id} className="document-card">
                                <ExportOutlined
                                    className="export-icon"
                                />
                                <DeleteOutlined
                                    className="delete-icon"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        confirmDelete(doc);
                                    }}
                                />
                                <div className="document-card-content" onClick={() => handleOpenDocument(doc)}>
                                    <div className="document-title">{doc.title}</div>
                                    <div className="document-preview">{doc.preview}</div>
                                    <div className="document-date">Последнее изменение: {new Date(doc.date).toISOString().split('T')[0].split('-').reverse().join('.')}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderContent = () => {
        if (currentDoc) return renderEditor();
        switch (selectedMenu) {
            case 'documents': return renderDocuments();
            case 'account': return <AccountPage />;
            case 'settings': return <SettingsPage />;
            default: return <div style={{ padding: 24 }}>Select a section</div>;
        }
    };

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider
                width={280}
                className="app-sider"
                collapsible
                collapsed={collapsed}
                onCollapse={value => setCollapsed(value)}
                lightTriggerColor={'#333131'}
            >
                <div className="logo">Рефлексия AI</div>
                <Menu
                    theme={document.body.classList.contains('dark-theme') ? 'dark' : 'light'}
                    mode="inline"
                    selectedKeys={[selectedMenu]}
                    items={menuItems}
                    onClick={(e) => {
                        if (e.key === 'logout') {
                            handleLogout();
                        } else {
                            setSelectedMenu(e.key);
                            setCurrentDoc(null);
                            setSelection(null);
                        }
                    }}
                    style={{ borderRight: 0, fontSize: '16px' }}
                />
            </Sider>
            <Layout>
                <Content style={{ padding: '0 24px 24px', margin: 0, minHeight: 280 }}>
                    {renderContent()}
                </Content>
            </Layout>
        </Layout>
    );
};

export default App;