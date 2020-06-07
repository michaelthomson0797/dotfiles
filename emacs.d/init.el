;; load user-specific variables

;; Added by Package.el.  This must come before configurations of
;; installed packages.  Don't delete this line.  If you don't want it,
;; just comment it out by adding a semicolon to the start of the line.
;; You may delete these explanatory comments.
;;(package-initialize)

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
   '("fa2b58bb98b62c3b8cf3b6f02f058ef7827a8e497125de0254f56e373abee088" "bffa9739ce0752a37d9b1eee78fc00ba159748f50dc328af4be661484848e476" "1b8d67b43ff1723960eb5e0cba512a2c7a2ad544ddb2533a90101fd1852b426e" default))
 '(org-agenda-files '("~/Dropbox/everything/everything.org"))
 '(package-selected-packages
   '(jedi mu4e-alert xkcd helm-spotify ace-window haskell-mode mu4e mu gnuplot evil-easymotion google-this company irony company-irony elpy magit org-download slack helm evil org-bullets color-theme-sanityinc-tomorrow doom-themes use-package))
 '(send-mail-function 'smtpmail-send-it))
(custom-set-faces
 ;; custom-set-faces was added by Custom.
 ;; If you edit it by hand, you could mess it up, so be careful.
 ;; Your init file should contain only one such instance.
 ;; If there is more than one, they won't work right.
 )
