;; load user-specific variables
(when (file-exists-p "~/.emacs.d/user.el")
  (load "~/.emacs.d/user.el"))

;; load config
(org-babel-load-file "~/.emacs.d/README.org")

(custom-set-variables
 ;; custom-set-variables was added by Custom.
 ;; If you edit it by hand, you could mess it up, so be careful.
 ;; Your init file should contain only one such instance.
 ;; If there is more than one, they won't work right.
 '(custom-safe-themes
   (quote
    ("1b8d67b43ff1723960eb5e0cba512a2c7a2ad544ddb2533a90101fd1852b426e" default)))
 '(org-agenda-files (quote ("~/Dropbox/jonah/jonah.org")))
 '(package-selected-packages
   (quote
    (jedi mu4e-alert xkcd helm-spotify ace-window haskell-mode mu4e mu gnuplot evil-easymotion google-this company irony company-irony elpy magit org-download slack helm evil org-bullets color-theme-sanityinc-tomorrow doom-themes use-package)))
 '(send-mail-function (quote smtpmail-send-it)))
(custom-set-faces
 ;; custom-set-faces was added by Custom.
 ;; If you edit it by hand, you could mess it up, so be careful.
 ;; Your init file should contain only one such instance.
 ;; If there is more than one, they won't work right.
 )
