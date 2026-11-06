# Recettes
recettes de cuisines

## Consulter les recettes en local

L’application lit les fichiers Markdown directement dans ce dépôt. Elle ne
nécessite ni compilation ni dépendance à installer.

1. Depuis la racine du dépôt, lancez `python3 server.py`.
2. Ouvrez <http://127.0.0.1:8000> dans votre navigateur.
3. Ajoutez ou modifiez un fichier `.md` : la liste et la recette affichée sont
   actualisées automatiquement sous deux secondes.

Les dossiers et sous-dossiers sont présentés sous forme de catégories
dépliables dans le menu latéral.

La recherche porte aussi sur le contenu des recettes et ignore les accents.
Les favoris, les ingrédients cochés et la liste de courses sont enregistrés
dans le navigateur. Les recettes peuvent être partagées avec leur lien direct.
Le mode cuisine affiche les étapes une par une ; le réglage des portions apparaît
quand la recette indique son nombre de portions.

## Ajouter des informations à une recette

Pour afficher une durée, des portions, une photo ou activer les filtres
« Végétariennes » et « ≤ 30 min », ajoutez un en-tête facultatif au début du
fichier Markdown :

```yaml
---
title: Dahl de lentilles corail
preparation: 10
cuisson: 25
portions: 4
tags: [vegetarien]
image: photos/dahl.jpg
image_alt: Dahl de lentilles corail servi dans un bol
---
```

Les durées sont exprimées en minutes. Le filtre végétarien se base uniquement
sur le tag `vegetarien` explicite ; le filtre rapide utilise le temps total
calculé ou le champ `temps_total`. Les filtres correspondants restent désactivés
tant qu’aucune recette ne dispose de l’information nécessaire. Les images
doivent être accessibles à l’adresse indiquée, relativement au fichier de la
recette.

Les intitulés affichés dans le menu peuvent être différents des noms de dossiers,
sans changer l’organisation des fichiers Markdown.

Pour arrêter le serveur, utilisez `Ctrl+C` dans le terminal.

## Publier le site sur GitHub Pages

Le workflow `.github/workflows/pages.yml` publie automatiquement le site après
chaque `push` sur `main`. Le site publié est public, même si ce dépôt reste
privé. Les visiteurs n’ont pas besoin de compte GitHub.

Pour activer la publication, ouvrez **Settings → Pages** dans le dépôt et
choisissez **GitHub Actions** comme source de déploiement. Après le premier
`push` sur `main`, l’adresse du site apparaîtra dans cette page.

Chaque déploiement inclut les recettes Markdown du dépôt. Une modification
locale apparaît sur le site après avoir été commitée et poussée vers GitHub,
puis après la fin du workflow Pages. L’utilisation de Pages avec un dépôt privé
peut nécessiter une offre GitHub qui prend en charge Pages pour les dépôts
privés.
