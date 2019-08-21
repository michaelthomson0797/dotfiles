;; load user-specific variables
(when (file-exists-p "~/.emacs.d/user.el")
  (load "~/.emacs.d/user.el"))

(require 'package)
(add-to-list 'package-archives '("org" . "http://orgmode.org/elpa/"))
(add-to-list 'package-archives '("melpa" . "http://melpa.org/packages/"))
(add-to-list 'package-archives '("melpa-stable" . "http://stable.melpa.org/packages/"))
(setq package-enable-at-startup nil)
(package-initialize)

(unless (package-installed-p 'use-package)
  (package-refresh-contents)
  (package-install 'use-package))
(require 'use-package)
(setq use-package-always-ensure t)

(custom-set-variables
 ;; custom-set-variables was added by Custom.
 ;; If you edit it by hand, you could mess it up, so be careful.
 ;; Your init file should contain only one such instance.
 ;; If there is more than one, they won't work right.
 '(custom-safe-themes
   (quote
    ("1b8d67b43ff1723960eb5e0cba512a2c7a2ad544ddb2533a90101fd1852b426e" default)))
 '(package-selected-packages
   (quote
    (mu4e mu gnuplot evil-easymotion google-this company irony company-irony elpy magit org-download slack helm evil org-bullets color-theme-sanityinc-tomorrow doom-themes use-package)))
 '(send-mail-function (quote smtpmail-send-it)))
(custom-set-faces
 ;; custom-set-faces was added by Custom.
 ;; If you edit it by hand, you could mess it up, so be careful.
 ;; Your init file should contain only one such instance.
 ;; If there is more than one, they won't work right.
 )

;; Essentials
(setq inhibit-splash-screen t
      inhibit-startup-message t
      inhibit-startup-echo-area-message "wolfe")
(tool-bar-mode -1)
(scroll-bar-mode -1)
(menu-bar-mode -1)
(show-paren-mode t)
(setq initial-scratch-message "")
(fset 'yes-or-no-p 'y-or-n-p)
(setq-default indent-tabs-mode nil)
(delete-selection-mode 1)
(when (member "Inconsolata" (font-family-list))
  (add-to-list 'default-frame-alist '(font . "Inconsolata-13" ))
  (set-face-attribute 'default t :font "Inconsolata-13"))

;; Change autosave directory
(setq auto-save-file-name-transforms
      `((".*" ,"~/.emacs-backups")))

;; Change backup directory
(setq backup-directory-alist
      `((".*" . ,"~/.emacs-backups")))

;; Change default browser
(setq browse-url-browser-function 'browse-url-chromium)

;; Theme
(use-package color-theme-sanityinc-tomorrow
  :config
  (load-theme 'sanityinc-tomorrow-bright t))

;; Evil
(use-package evil
  :init ()
  :config
  (evil-mode 1))

(use-package evil-easymotion
  :config
  (evilem-default-keybindings "SPC"))

;; org
(use-package org
  :config
  (org-display-inline-images t)
  (setq org-log-done 'time)
  (setq org-image-actual-width nil)
  (setq org-todo-keywords
        '((sequence "TODO" "STARTED" "WAITING" "|" "DONE" "CANCELED"))))

(use-package org-bullets
  :config
  (add-hook 'org-mode-hook (lambda () (org-bullets-mode 1))))

(use-package org-download
  :config
  (add-hook 'dired-mode-hook 'org-download-enable)
  (setq-default org-download-image-dir "./img"))

(org-babel-do-load-languages
 'org-babel-load-languages
 '((python . t)))

(use-package gnuplot)

;; google
(use-package google-this
  :bind
  ("C-x g" . google-this)
  :config
  (google-this-mode 1))

;; Helm
(use-package helm
  :bind (("M-x" . helm-M-x)
         ("C-x C-f" . helm-find-files)
         ("C-x b" . helm-buffers-list))
  :config(setq helm-mode-fuzzy-match t))

;; Company
(use-package company
  :init
  (global-company-mode))


;; Irony
(use-package irony
  :config
  (add-hook 'c++-mode-hook 'irony-mode)
  (add-hook 'c-mode-hook 'irony-mode)
  (add-hook 'objc-mode-hook 'irony-mode)
  (add-hook 'irony-mode-hook 'irony-cdb-autosetup-compile-options))

(use-package company-irony
  :config
  (add-to-list 'company-backends 'company-irony))


;; robot mode
(load-file "~/.emacs.d/robot-mode/robot-mode.el")
(add-to-list 'auto-mode-alist '("\\.robot\\'" . robot-mode))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; mail
;; Account information is held in ~/.emacs.d/user.el
;; uses offlineimap and the Maildir folder
;; the folder structure is ~/Maildir/account1, ~/Maildir/account2
;; the following variables must be defined:
;;   * full-name = full name of user
;;   * mu4e-acc1 = name of account
;;   * mu4e-acc1-mail-address = mail address of account
;;   * mu4e-acc1-smtp-server = smtp server of account
;;   * mu4e-acc1-smtp-port = port of smtp server
;;
;; simply add more variables with acc2 for a second account
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
(require 'mu4e)

;; set mail directory. this must match the maildir of your .offlineimaprc
(setq mu4e-maildir (expand-file-name "~/Maildir"))
(setq mu4e-view-show-images t)
(setq mu4e-sent-messages-behavior 'sent)
(setq message-send-mail-function 'smtpmail-send-it)
(setq mu4e-update-interval 300)

;; set "main" account information.
(setq mu4e-drafts-folder (concat "/" mu4e-acc1 "/Drafts")
      mu4e-sent-folder (concat "/" mu4e-acc1 "/Sent")
      mu4e-trash-folder (concat "/" mu4e-acc1 "/Trash")
      mu4e-get-mail-command "offlineimap"
      smtpmail-stream-type 'starttls
      smtpmail-smtp-server mu4e-acc1-smtp-server
      smtpmail-smtp-service mu4e-acc1-smtp-port
      smtpmail-smtp-user mu4e-acc1-mail-address
      user-mail-address mu4e-acc1-mail-address
      user-full-name full-name)

;; defines a list of accounts. account information entered before must also be included in the list
;; just delete this if you only use one account
(defvar my-mu4e-account-alist
  '((mu4e-acc1
     (mu4e-drafts-folder (concat "/" mu4e-acc1 "/Drafts"))
     (mu4e-sent-folder (concat "/" mu4e-acc1 "/Sent"))
     (mu4e-trash-folder (concat "/" mu4e-acc1 "/Trash"))
     (smtpmail-smtp-server mu4e-acc1-smtp-server)
     (smtpmail-smtp-service mu4e-acc1-smtp-port)
     (smtpmail-smtp-user mu4e-acc1-mail-address)
     (user-mail-address mu4e-acc1-mail-address)
     (user-full-name full-name))
    (mu4e-acc2
     (mu4e-drafts-folder (concat "/" mu4e-acc2 "/Drafts"))
     (mu4e-sent-folder (concat "/" mu4e-acc2 "/Sent"))
     (mu4e-trash-folder (concat "/" mu4e-acc2 "/Trash"))
     (smtpmail-smtp-server mu4e-acc2-smtp-server)
     (smtpmail-smtp-service mu4e-acc2-smtp-port)
     (smtpmail-smtp-user mu4e-acc2-mail-address)
     (user-mail-address mu4e-acc2-mail-address)
     (user-full-name full-name))))

;; When composing a message, ask the user which account to use with tab-completion
(defun my-mu4e-set-account ()
  "Set the account for composing a message."
  (let* ((account
          (if mu4e-compose-parent-message
              (let ((maildir (mu4e-message-field mu4e-compose-parent-message :maildir)))
                (string-match "/\\(.*?\\)/" maildir)
                (match-string 1 maildir))
            (completing-read (format "Compose with account: (%s) "
                                     (mapconcat #'(lambda (var) (car var))
                                                my-mu4e-account-alist "/"))
                             (mapcar #'(lambda (var) (car var)) my-mu4e-account-alist)
                             nil t nil nil (caar my-mu4e-account-alist))))
         (account-vars (cdr (assoc account my-mu4e-account-alist))))
    (if account-vars
        (mapc #'(lambda (var)
                  (set (car var) (cadr var)))
              account-vars)
      (error "No email account found"))))

(add-hook 'mu4e-compose-pre-hook 'my-mu4e-set-account)
