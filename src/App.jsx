import React, { useState, useRef, useEffect } from 'react';
import { Layout, Menu, Button, Card, Space, Spin, message, Modal, Upload } from 'antd';
import {
    FileTextOutlined,
    UserOutlined,
    SettingOutlined,
    PlusOutlined,
    ArrowLeftOutlined,
    SaveOutlined,
    LoadingOutlined,
    DeleteOutlined,
    LogoutOutlined,
    CopyOutlined,
    UploadOutlined,
    ExportOutlined
} from '@ant-design/icons';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './App.css';
import SettingsPage from './SettingsPage.jsx';
import AccountPage from './AccountPage.jsx';
import { useNavigate } from 'react-router-dom';

const { Sider, Content } = Layout;

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
    const [processedText, setProcessedText] = useState('');
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
    const backButtonRef = useRef(null);
    const [documentToDelete, setDocumentToDelete] = useState(null);
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(false);

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
                backButtonRef.current &&
                !inputRef.current.contains(event.target) &&
                !submitButtonRef.current.contains(event.target) &&
                !backButtonRef.current.contains(event.target)
            ) {
                clearBackgroundFormatting();
            }
        };

        document.addEventListener('click', handleGlobalClick);
        return () => document.removeEventListener('click', handleGlobalClick);
    }, [selection]);

    // Функция для очистки фонового форматирования
    // Функция для очистки фонового форматирования
    const clearBackgroundFormatting = () => {
        if (quillRef.current) {
            const quill = quillRef.current.getEditor();
            const length = quill.getLength();
            // Очищаем только фоновое форматирование, сохраняя остальные стили
            quill.formatText(0, length, { background: false }, 'user');
            // Получаем очищенное содержимое как HTML
            const cleanHtml = quill.root.innerHTML;
            setEditorContent(cleanHtml);
            setSelection(null);
            setAiPrompt('');
            setProcessedText('');
            return cleanHtml;
        }
        return editorContent; // Возвращаем текущее содержимое, если quill недоступен
    };

    // Функция выхода из аккаунта
    const handleLogout = async () => {
        try {
            const response = await fetch('http://localhost:8082/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
            });

            if (response.ok) {
                message.success;
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

            return false; // Prevent Upload component from auto-uploading again
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
                // Если есть предыдущее выделение, убираем его фон
                if (selection) {
                    quill.formatText(selection.range.index, selection.range.length, {
                        background: false,
                    });
                }
                const text = quill.getText(range.index, range.length);
                setSelection({ text, range });
            } else if (selection && document.activeElement !== inputRef.current) {
                clearBackgroundFormatting();
            }
        }
    };

    const handleInputClick = () => {
        if (quillRef.current && selection) {
            const quill = quillRef.current.getEditor();
            // Применяем имитацию выделения через форматирование фона
            quill.formatText(selection.range.index, selection.range.length, {
                background: document.body.classList.contains('dark-theme') ? '#508ec1' : '#fff9a8',
            });
            // Убедимся, что фокус остается на input
            inputRef.current.focus();
        }
    };

    const handleKeyDown = (event) => {
        if (quillRef.current && selection && (event.ctrlKey || event.metaKey) && event.key === 'z') {
            clearBackgroundFormatting();
        }
    };

    const handleProcessText = async () => {
        if (!selection || !selection.text || !aiPrompt.trim()) {
            message.error('Выделите текст и введите запрос для обработки');
            return;
        }

        setIsProcessing(true);
        setProcessedText('');

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
                setProcessedText(retryData.result || 'Ошибка: пустой результат');
            } else if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            } else {
                const data = await response.json();
                setProcessedText(data.result || 'Ошибка: пустой результат');
            }
        } catch (error) {
            console.error('Failed to process text:', error);
            setProcessedText(`Ошибка обработки: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReplaceText = () => {
        if (quillRef.current && selection) {
            const quill = quillRef.current.getEditor();
            // Удаляем имитацию выделения перед заменой
            quill.formatText(selection.range.index, selection.range.length, {
                background: false,
            });
            quill.deleteText(selection.range.index, selection.range.length);
            quill.insertText(selection.range.index, processedText);
            setProcessedText('');
            setAiPrompt('');
            setSelection(null);
        }
    };

    const handleCopyText = () => {
        navigator.clipboard.writeText(processedText)
            .then(() => {
                message.success('Текст скопирован в буфер обмена');
            })
            .catch((error) => {
                console.error('Failed to copy text:', error);
                message.error('Ошибка при копировании текста');
            });
    };

    const handleCancelPreview = () => {
        setProcessedText('');
        setAiPrompt('');
        // Не сбрасываем selection, чтобы сохранить имитацию выделения
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

    const handleSave = async () => {
        if (!currentDoc) return;

        // Очищаем форматирование и обновляем editorContent
        let cleanContent = editorContent;
        if (quillRef.current) {
            cleanContent = clearBackgroundFormatting();
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

    const handleBack = async () => {
        // Очищаем форматирование и обновляем editorContent
        let cleanContent = editorContent;
        if (quillRef.current) {
            cleanContent = clearBackgroundFormatting();
        }

        // Проверяем, нужно ли сохранять документ
        if (cleanContent !== originalContent || currentDoc?.title !== currentDoc?.title) {
            await handleSave();
        }

        // Сбрасываем текущий документ и редактор
        setCurrentDoc(null);
        setEditorContent('');
        setOriginalContent('');
    };

    const modules = {
        toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'align': '' }, { 'align': 'center' }, { 'align': 'right' }, { 'align': 'justify' }],
            [{ 'color': [] }, { 'background': [] }],
            ['link', 'image'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            ['clean']
        ],
    };

    const formats = [
        'header',
        'bold', 'italic', 'underline', 'strike',
        'align',
        'color', 'background',
        'link', 'image',
        'list', 'bullet',
    ];

    const renderEditor = () => (
        <div className="editor-container">
            <div className="editor-header">
                <Button icon={<ArrowLeftOutlined />} onClick={handleBack} type="text" className="back-button">Назад</Button>
                <div className="title-wrapper">
                    <input
                        type="text"
                        value={currentDoc?.title || ''}
                        onChange={(e) => setCurrentDoc(prev => ({ ...prev, title: e.target.value }))}
                        className="document-title-input"
                        placeholder="Название документа"
                    />
                </div>
                <Button icon={<SaveOutlined />} onClick={handleSave} type="primary" className="save-button" disabled={!currentDoc || isLoadingDocuments}>
                    Сохранить
                </Button>
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
                {(isProcessing || processedText) && (
                    <div className="ai-preview-container" ref={previewRef}>
                        {isProcessing ? (
                            <div className="spinner-container">
                                <Spin indicator={<LoadingOutlined spin />} size="large" />
                            </div>
                        ) : (
                            <div className="preview-content">
                                <div
                                    className="preview-text"
                                    dangerouslySetInnerHTML={{
                                        __html: processedText
                                            .replace(/\n/g, '<br/>')
                                            .replace(/\r\n/g, '<br/>')
                                    }}
                                />
                                <div className="preview-buttons">
                                    <Button ref={backButtonRef} onClick={handleCancelPreview}>Назад</Button>
                                    <Button onClick={handleCopyText} icon={<CopyOutlined />}>Скопировать</Button>
                                    <Button type="primary" onClick={handleReplaceText}>Заменить</Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                <div className="ai-input-container">
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
                        Отправить
                    </Button>
                </div>
            </div>
        </div>
    );

    const renderDocuments = () => {
        if (isLoadingDocuments) return <div className="centered-spin"><Spin indicator={<LoadingOutlined style={{ fontSize: 36 }} spin />} tip="Loading documents..." /></div>;
        if (fetchError) return <div className="centered-error">Error loading documents: {fetchError} <Button onClick={() => fetchDocuments()}>Retry</Button></div>;

        return (
            <>
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
            </>
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
                <Content style={{ padding: '24px', margin: 0, minHeight: 280 }}>
                    {renderContent()}
                </Content>
            </Layout>
        </Layout>
    );
};

export default App;